// Run with Node >=22.19: node --experimental-vm-modules --test tests/twilio-start.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

// --- Import and external-boundary helpers ---
async function bridge(
	path,
	{ connectGate, openGate, failConnect = false, failConfig = false } = {},
) {
	// Import the complete module without binding a port or contacting a service.
	const context = vm.createContext({ console: { log() {}, error() {} }, URL });
	const routes = new Map();
	const listeners = new Map();
	const audio = [],
		configs = [],
		output = [],
		tools = [],
		carrier = [],
		lifecycle = [];
	let options;
	let connects = 0;
	let carrierCloses = 0;
	const socket = {
		on(event, fn) {
			listeners.set(event, fn);
		},
		async waitForOpen() {
			await openGate;
			lifecycle.push("open");
		},
		sendConfig(config) {
			if (failConfig) throw new Error("config failed");
			lifecycle.push("config");
			configs.push(config);
			listeners.get("message")({ type: "conversation_created" });
			listeners.get("message")({
				type: "audio_chunk",
				audio: "first-greeting-chunk",
			});
		},
		async sendAudioChunk(chunk) {
			audio.push(chunk);
		},
		async sendToolCallOutput(chunk) {
			output.push(chunk);
		},
		close() {
			lifecycle.push("close");
		},
	};
	class Hono {
		post() {}
		get(route, handler) {
			routes.set(route, handler);
		}
	}
	class PhonicClient {
		constructor(config) {
			options = config;
		}
		conversations = {
			connect: async () => {
				connects++;
				await connectGate;
				if (failConnect) throw new Error("connect failed");
				return socket;
			},
		};
	}
	const boundaries = {
		"@hono/node-server": { serve: () => ({}) },
		"@hono/node-ws": {
			createNodeWebSocket: () => ({
				injectWebSocket() {},
				upgradeWebSocket: (factory) => factory,
			}),
		},
		hono: { Hono },
		phonic: { PhonicClient },
		"twilio/lib/twiml/VoiceResponse": { default: class {} },
		"./env-vars": { phonicApiKey: "inert-test-value" },
		"./call-tool": {
			handleToolCall: async (message) => {
				tools.push(message);
				return { temperature: "72F" };
			},
		},
	};
	const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
	const module = new vm.SourceTextModule(stripTypeScriptTypes(source), {
		context,
	});
	await module.link((specifier) => {
		assert.ok(
			Object.hasOwn(boundaries, specifier),
			`Unexpected import: ${specifier}`,
		);
		const exports = boundaries[specifier];
		return new vm.SyntheticModule(
			Object.keys(exports),
			function () {
				for (const [key, value] of Object.entries(exports))
					this.setExport(key, value);
			},
			{ context },
		);
	});
	await module.evaluate();
	const handler = routes.get("/ws")();
	const ws = {
		send: (data) => carrier.push(JSON.parse(data)),
		close() {
			carrierCloses++;
		},
	};
	const opened = handler.onOpen?.({}, ws);
	if (!connectGate && !openGate) await opened;
	return {
		opened,
		audio,
		configs,
		output,
		tools,
		carrier,
		lifecycle,
		options,
		get connects() {
			return connects;
		},
		get carrierCloses() {
			return carrierCloses;
		},
		close: () => handler.onClose(),
		stop: () =>
			handler.onMessage({ data: JSON.stringify({ event: "stop" }) }, ws),
		emit: (message) => listeners.get("message")(message),
		start: () =>
			handler.onMessage(
				{ data: JSON.stringify({ event: "start", streamSid: "MZ-test" }) },
				ws,
			),
		media: (track = "inbound") =>
			handler.onMessage(
				{
					data: JSON.stringify({
						event: "media",
						media: { track, payload: "caller-audio" },
					}),
				},
				ws,
			),
		reopen: () => listeners.get("open")?.(),
	};
}
// --- End helpers ---

function deferred() {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

for (const path of [
	"03-conversation-websocket/node/server.ts",
	"04-conversation-websocket-tools/node/index.ts",
]) {
	test(`${path}: waits for carrier start and delivers the first greeting chunk`, async () => {
		const b = await bridge(path);
		await b.media();
		assert.equal(b.connects, 1);
		assert.equal(b.configs.length, 0);
		assert.equal(b.audio.length, 0);
		await b.start();
		assert.equal(b.connects, 1);
		assert.deepEqual(b.carrier, [
			{
				event: "media",
				streamSid: "MZ-test",
				media: { payload: "first-greeting-chunk" },
			},
		]);
		await b.media("outbound");
		assert.equal(b.audio.length, 0);
		await b.media();
		assert.equal(b.audio.length, 1);
		await b.start();
		await b.reopen();
		assert.equal(b.connects, 1);
		assert.equal(b.configs.length, 1);
		assert.equal(b.options.reconnectConversationOnAbnormalDisconnect, true);
		b.close();
		assert.equal(b.lifecycle.at(-1), "close");
	});

	test(`${path}: duplicate start during connect cannot create another conversation`, async () => {
		const gate = deferred();
		const b = await bridge(path, { connectGate: gate.promise });
		await b.start();
		await b.start();
		await b.media();
		assert.equal(b.connects, 1);
		assert.equal(b.audio.length, 0);
		gate.resolve();
		await b.opened;
		assert.equal(b.configs.length, 1);
		b.close();
	});

	test(`${path}: Twilio first waits for socket open, then configures exactly once`, async () => {
		const gate = deferred();
		const b = await bridge(path, { openGate: gate.promise });
		await b.start();
		await b.start();
		assert.equal(b.configs.length, 0);
		assert.deepEqual(b.carrier, []);
		gate.resolve();
		await b.opened;
		assert.equal(b.configs.length, 1);
		assert.equal(b.carrier[0].media.payload, "first-greeting-chunk");
		await b.start();
		await b.reopen();
		assert.equal(b.configs.length, 1);
		b.close();
	});

	for (const stage of ["connect", "open"]) {
		for (const end of ["close", "stop"]) {
			test(`${path}: ${end} during ${stage} prevents config and closes socket`, async () => {
				const gate = deferred();
				const b = await bridge(path, { [stage + "Gate"]: gate.promise });
				await b.start();
				await Promise.resolve();
				await b[end]();
				gate.resolve();
				await b.opened;
				assert.equal(b.configs.length, 0);
				assert.ok(b.lifecycle.includes("close"));
				await b.start();
				assert.equal(b.connects, 1);
			});
		}
	}

	test(`${path}: close before start closes the early socket without config`, async () => {
		const b = await bridge(path);
		b.close();
		await b.start();
		assert.equal(b.connects, 1);
		assert.equal(b.configs.length, 0);
		assert.ok(b.lifecycle.includes("close"));
	});

	test(`${path}: config failure when Twilio arrives first closes the carrier`, async () => {
		const gate = deferred();
		const b = await bridge(path, { openGate: gate.promise, failConfig: true });
		await b.start();
		gate.resolve();
		await b.opened;
		assert.equal(b.carrierCloses, 1);
		assert.equal(b.configs.length, 0);
		assert.ok(b.lifecycle.includes("close"));
	});

	for (const failure of ["failConnect", "failConfig"]) {
		test(`${path}: ${failure} closes the carrier`, async () => {
			const b = await bridge(path, { [failure]: true });
			await b.start();
			assert.equal(b.carrierCloses, 1);
			await b.start();
			assert.equal(b.connects, 1);
		});
	}
}

test("04: tools retain their call ID after stream start", async () => {
	const b = await bridge("04-conversation-websocket-tools/node/index.ts");
	await b.start();
	await b.emit({
		type: "tool_call",
		tool_call_id: "tool-test",
		parameters: { city: "Boston" },
	});
	assert.equal(b.tools.length, 1);
	assert.deepEqual(JSON.parse(JSON.stringify(b.output)), [
		{
			type: "tool_call_output",
			tool_call_id: "tool-test",
			output: { temperature: "72F" },
		},
	]);
	b.close();
});

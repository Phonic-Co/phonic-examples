// Run with Node >=22.19: node --experimental-vm-modules --test tests/twilio-readiness.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

// --- Import and external-boundary helpers ---
async function bridge(path) {
  // Import the complete module without binding a port or contacting a service.
  const context = vm.createContext({ console: { log() {}, error() {} }, URL });
  const routes = new Map();
  const listeners = new Map();
  const audio = [], configs = [], output = [], tools = [], carrier = [], lifecycle = [];
  let options;
  const socket = {
    on(event, fn) { listeners.set(event, fn); },
    async waitForOpen() { await Promise.resolve(); lifecycle.push("open"); },
    sendConfig(config) { lifecycle.push("config"); configs.push(config); },
    async sendAudioChunk(chunk) { audio.push(chunk); },
    async sendToolCallOutput(chunk) { output.push(chunk); },
    close() { lifecycle.push("close"); },
  };
  class Hono {
    post() {}
    get(route, handler) { routes.set(route, handler); }
  }
  class PhonicClient {
    constructor(config) { options = config; }
    conversations = { connect: async () => socket };
  }
  const boundaries = {
    "@hono/node-server": { serve: () => ({}) },
    "@hono/node-ws": { createNodeWebSocket: () => ({
      injectWebSocket() {}, upgradeWebSocket: (factory) => factory,
    }) },
    hono: { Hono }, phonic: { PhonicClient },
    "twilio/lib/twiml/VoiceResponse": { default: class {} },
    "./env-vars": { phonicApiKey: "inert-test-value" },
    "./call-tool": { handleToolCall: async (message) => {
      tools.push(message); return { temperature: "72F" };
    } },
  };
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
  await module.link((specifier) => {
    assert.ok(Object.hasOwn(boundaries, specifier), `Unexpected import: ${specifier}`);
    const exports = boundaries[specifier];
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const handler = routes.get("/ws")();
  const ws = { send: (data) => carrier.push(JSON.parse(data)), close() {} };
  await handler.onOpen({}, ws);
  return {
    audio, configs, output, tools, carrier, lifecycle, options,
    emit: (message) => listeners.get("message")(message),
    start: () => handler.onMessage({ data: JSON.stringify({ event: "start", streamSid: "MZ-test" }) }, ws),
    media: (track = "inbound") => handler.onMessage({ data: JSON.stringify({
      event: "media", media: { track, payload: "caller-audio" },
    }) }, ws),
    reopen: () => listeners.get("open")?.(),
  };
}
// --- End helpers ---

for (const path of ["03-conversation-websocket/node/server.ts", "04-conversation-websocket-tools/node/index.ts"]) {
  test(`${path}: readiness before carrier start forwards caller audio once`, async () => {
    const b = await bridge(path);
    await b.emit({ type: "conversation_created", conversation_id: "conv-test" });
    await b.start();
    await b.media();
    assert.deepEqual(JSON.parse(JSON.stringify(b.audio)), [{ type: "audio_chunk", audio: "caller-audio" }]);
  });

  test(`${path}: carrier start before readiness and reconnect notification still forwards`, async () => {
    const b = await bridge(path);
    await b.start();
    await b.emit({ type: "conversation_created", conversation_id: "conv-test" });
    await b.emit({ type: "conversation_reconnected", conversation_id: "conv-test" });
    await b.media();
    assert.equal(b.audio.length, 1);
  });

  test(`${path}: media stays gated; config waits for open and is sent once`, async () => {
    const b = await bridge(path);
    await b.media();
    await b.start();
    await b.media();
    assert.equal(b.audio.length, 0);
    await b.emit({ type: "conversation_created", conversation_id: "conv-test" });
    await b.media("outbound");
    assert.equal(b.audio.length, 0);
    await b.media();
    assert.equal(b.audio.length, 1);
    await b.reopen();
    assert.deepEqual(b.lifecycle, ["open", "config"]);
    assert.equal(b.configs.length, 1);
    assert.equal(b.options.reconnectConversationOnAbnormalDisconnect, true);
  });

  test(`${path}: outbound audio waits for stream ID`, async () => {
    const b = await bridge(path);
    await b.emit({ type: "audio_chunk", audio: "early" });
    assert.deepEqual(b.carrier, []);
    await b.start();
    await b.emit({ type: "audio_chunk", audio: "agent-audio" });
    assert.deepEqual(b.carrier, [{ event: "media", streamSid: "MZ-test", media: { payload: "agent-audio" } }]);
  });
}

test("04 Node: tools still require carrier start and retain call ID", async () => {
  const b = await bridge("04-conversation-websocket-tools/node/index.ts");
  const message = { type: "tool_call", tool_call_id: "tool-test", tool_name: "get_temperature", parameters: { city: "Boston" } };
  await b.emit(message);
  assert.equal(b.tools.length, 0);
  await b.start();
  await b.emit(message);
  assert.equal(b.tools.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(b.output)), [{ type: "tool_call_output", tool_call_id: "tool-test", output: { temperature: "72F" } }]);
});

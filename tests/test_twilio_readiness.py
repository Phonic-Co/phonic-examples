"""Exercise registered endpoints without servers, credentials or third-party installs."""
import asyncio
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch


# --- Import and external-boundary helpers ---
class Payload(SimpleNamespace):
    pass


class AudioChunkPayload(Payload):
    pass


class ToolCallOutputPayload(Payload):
    pass


class FakeApp:
    def __init__(self):
        self.routes = {}

    def post(self, route):
        return lambda fn: fn

    def websocket(self, route):
        def register(fn):
            self.routes[route] = fn
            return fn
        return register


class Socket:
    def __init__(self):
        self.callbacks = {}
        self.configs, self.audio, self.output = [], [], []
        self.ready = asyncio.Event()
        self.finished = asyncio.Event()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        self.finished.set()

    def on(self, event, callback):
        self.callbacks[event] = callback

    async def start_listening(self):
        await self.finished.wait()

    async def send_config(self, config):
        self.configs.append(config)
        self.ready.set()

    async def send_audio_chunk(self, chunk):
        self.audio.append(chunk)

    async def send_tool_call_output(self, chunk):
        self.output.append(chunk)

    async def emit(self, **message):
        await self.callbacks["message"](Payload(**message))


class Carrier:
    def __init__(self):
        self.incoming = asyncio.Queue()
        self.previous_ack = None
        self.sent = []

    async def accept(self):
        pass

    async def receive_json(self):
        # Acknowledge only after the endpoint has processed the prior frame.
        if self.previous_ack:
            self.previous_ack.set_result(None)
        message, self.previous_ack = await self.incoming.get()
        return message

    async def send_json(self, message):
        self.sent.append(message)

    async def deliver(self, event, **fields):
        ack = asyncio.get_running_loop().create_future()
        await self.incoming.put(({"event": event, **fields}, ack))
        await asyncio.wait_for(ack, 1)


def load_bridge(path, socket, tools):
    """Keep endpoint registration real while isolating network and tool boundaries."""
    options = {}

    def client(**kwargs):
        options.update(kwargs)
        return SimpleNamespace(conversations=SimpleNamespace(connect=lambda: socket))

    exports = {
        "uvicorn": {}, "dotenv": {"load_dotenv": lambda *_: None},
        "fastapi": {"FastAPI": FakeApp, "Response": Payload, "WebSocket": Carrier},
        "phonic": {"AsyncPhonic": client, "AudioChunkPayload": AudioChunkPayload,
                   "ToolCallOutputPayload": ToolCallOutputPayload, "ToolCallPayload": Payload},
        "phonic.conversations.socket_client": {"ConversationsSocketClientResponse": Payload},
        "phonic.types.config_payload": {"ConfigPayload": Payload},
        "twilio.twiml.voice_response": {"Connect": Payload, "VoiceResponse": Payload},
        "call_tool": {"get_flights": lambda **args: tools.append(args) or {"flight": "test"}},
    }
    modules = {}
    for name, attrs in exports.items():
        modules[name] = ModuleType(name)
        vars(modules[name]).update(attrs)
    spec = importlib.util.spec_from_file_location("bridge_under_test", Path(__file__).resolve().parents[1] / path)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module.app.routes["/ws"], options
# --- End helpers ---


class ReadinessTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, path, scenario):
        socket, carrier, tools = Socket(), Carrier(), []
        endpoint, options = load_bridge(path, socket, tools)
        task = asyncio.create_task(endpoint(carrier))
        try:
            await asyncio.wait_for(socket.ready.wait(), 1)
            await scenario(socket, carrier, tools)
        finally:
            await carrier.incoming.put(({"event": "closed"}, None))
            await asyncio.wait_for(task, 1)
        self.assertEqual(len(socket.configs), 1)
        self.assertTrue(options["reconnect_conversation_on_abnormal_disconnect"])
        return socket


# --- Scenario helpers ---
async def start(carrier):
    await carrier.deliver("start", streamSid="MZ-test")


async def media(carrier):
    await carrier.deliver("media", media={"payload": "caller-audio"})


async def ready_first(socket, carrier, _):
    await socket.emit(type="conversation_created", conversation_id="conv-test")
    await start(carrier)
    await media(carrier)


async def start_first(socket, carrier, _):
    await start(carrier)
    await socket.emit(type="conversation_created", conversation_id="conv-test")
    await socket.emit(type="conversation_reconnected", conversation_id="conv-test")
    await media(carrier)


async def gated(socket, carrier, _):
    await media(carrier)
    await start(carrier)
    await media(carrier)


async def outbound(socket, carrier, _):
    await socket.emit(type="audio_chunk", audio="early")
    assert carrier.sent == []
    await start(carrier)
    await socket.emit(type="audio_chunk", audio="agent-audio")
    assert carrier.sent == [{"event": "media", "streamSid": "MZ-test", "media": {"payload": "agent-audio"}}]


def scenario_test(path, scenario, expected_audio):
    async def run(self):
        socket = await self.exercise(path, scenario)
        self.assertEqual([chunk.audio for chunk in socket.audio], expected_audio)
    return run
# --- End helpers ---


for example in ("03-conversation-websocket", "04-conversation-websocket-tools"):
    for scenario, expected in ((ready_first, ["caller-audio"]), (start_first, ["caller-audio"]), (gated, []), (outbound, [])):
        setattr(ReadinessTests, f"test_{example[:2]}_{scenario.__name__}", scenario_test(f"{example}/python/server.py", scenario, expected))


class ToolTests(unittest.IsolatedAsyncioTestCase):
    exercise = ReadinessTests.exercise
    async def test_tools_keep_start_gate_and_call_id(self):
        async def immediate_thread(fn, **kwargs):
            return fn(**kwargs)

        async def scenario(socket, carrier, tools):
            message = dict(type="tool_call", tool_call_id="tool-test", parameters={"date": "2027-01-01", "from_airport": "BOS", "to_airport": "SFO"})
            await socket.emit(**message)
            await asyncio.sleep(0)
            self.assertEqual(tools, [])
            await start(carrier)
            await socket.emit(**message)
            await asyncio.sleep(0)
            self.assertEqual(len(tools), 1)

        with patch.object(asyncio, "to_thread", immediate_thread):
            socket = await self.exercise("04-conversation-websocket-tools/python/server.py", scenario)
        self.assertEqual(len(socket.output), 1)
        self.assertEqual(socket.output[0].tool_call_id, "tool-test")
        self.assertEqual(socket.output[0].output, {"flights": {"flight": "test"}})


if __name__ == "__main__":
    unittest.main()

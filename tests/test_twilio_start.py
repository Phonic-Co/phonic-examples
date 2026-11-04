"""Run: python3 -B -m unittest discover -s tests -p test_twilio_start.py -v

Exercise registered endpoints without servers, credentials or third-party installs.
"""

import asyncio
import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch


# --- Import and external-boundary helpers ---
class Payload(SimpleNamespace):
    pass


class AudioChunkPayload(Payload):
    pass


class ToolCallOutputPayload(Payload):
    pass


class WebSocketDisconnect(Exception):
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
        self.connects = 0
        self.entered = asyncio.Event()
        self.connect_gate = asyncio.Event()
        self.connect_gate.set()
        self.config_gate = asyncio.Event()
        self.config_gate.set()
        self.listening_done = asyncio.Event()
        self.ready = asyncio.Event()
        self.finished = asyncio.Event()

    async def __aenter__(self):
        self.connects += 1
        self.entered.set()
        await self.connect_gate.wait()
        return self

    async def __aexit__(self, *_):
        self.finished.set()

    def on(self, event, callback):
        self.callbacks[event] = callback

    async def start_listening(self):
        try:
            await self.finished.wait()
        finally:
            self.listening_done.set()

    async def send_config(self, config):
        await self.config_gate.wait()
        self.configs.append(config)
        await self.emit(type="conversation_created")
        await self.emit(type="audio_chunk", audio="first-greeting-chunk")
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
        if isinstance(message, Exception):
            raise message
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
        "uvicorn": {},
        "dotenv": {"load_dotenv": lambda *_: None},
        "fastapi": {
            "FastAPI": FakeApp,
            "Response": Payload,
            "WebSocket": Carrier,
            "WebSocketDisconnect": WebSocketDisconnect,
        },
        "phonic": {
            "AsyncPhonic": client,
            "AudioChunkPayload": AudioChunkPayload,
            "ToolCallOutputPayload": ToolCallOutputPayload,
            "ToolCallPayload": Payload,
        },
        "phonic.conversations.socket_client": {
            "ConversationsSocketClientResponse": Payload
        },
        "phonic.types.config_payload": {"ConfigPayload": Payload},
        "twilio.twiml.voice_response": {"Connect": Payload, "VoiceResponse": Payload},
        "call_tool": {
            "get_flights": lambda **args: tools.append(args) or {"flight": "test"}
        },
    }
    modules = {}
    for name, attrs in exports.items():
        modules[name] = ModuleType(name)
        vars(modules[name]).update(attrs)
    spec = importlib.util.spec_from_file_location(
        "bridge_under_test", Path(__file__).resolve().parents[1] / path
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module.app.routes["/ws"], options


# --- End helpers ---


class StartTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, path, scenario):
        socket, carrier, tools = Socket(), Carrier(), []
        endpoint, options = load_bridge(path, socket, tools)
        task = asyncio.create_task(endpoint(carrier))
        try:
            await scenario(socket, carrier, task, tools)
        finally:
            if not task.done():
                await carrier.incoming.put(({"event": "closed"}, None))
            await asyncio.wait_for(task, 1)
        self.assertTrue(options["reconnect_conversation_on_abnormal_disconnect"])
        return socket


async def normal(socket, carrier, task, tools):
    await carrier.deliver("connected")
    await carrier.deliver("media", media={"payload": "too-early"})
    assert socket.connects == 1
    assert socket.configs == []
    await carrier.deliver("start", streamSid="MZ-test")
    await asyncio.wait_for(socket.ready.wait(), 1)
    assert carrier.sent == [
        {
            "event": "media",
            "streamSid": "MZ-test",
            "media": {"payload": "first-greeting-chunk"},
        }
    ]
    await carrier.deliver("start", streamSid="duplicate-must-not-replace-id")
    await socket.emit(type="audio_chunk", audio="later")
    assert carrier.sent[-1]["streamSid"] == "MZ-test"
    await carrier.deliver("media", media={"payload": "caller-audio"})
    await asyncio.sleep(0)
    assert [c.audio for c in socket.audio] == ["caller-audio"]
    assert len(socket.configs) == 1
    assert socket.connects == 1


async def carrier_first(socket, carrier, task, tools):
    socket.connect_gate.clear()
    await carrier.deliver("start", streamSid="MZ-test")
    await socket.entered.wait()
    await carrier.deliver("start", streamSid="duplicate")
    assert socket.configs == []
    assert carrier.sent == []
    socket.connect_gate.set()
    await asyncio.wait_for(socket.ready.wait(), 1)
    assert len(socket.configs) == 1
    assert carrier.sent[0]["streamSid"] == "MZ-test"
    assert carrier.sent[0]["media"]["payload"] == "first-greeting-chunk"


async def close_before_start(socket, carrier, task, tools):
    await carrier.deliver("connected")
    await carrier.incoming.put((WebSocketDisconnect(), None))
    await asyncio.wait_for(task, 1)
    assert socket.connects == 1
    assert socket.configs == []
    assert socket.finished.is_set()


async def stop_before_start(socket, carrier, task, tools):
    await socket.entered.wait()
    await carrier.incoming.put(({"event": "stop"}, None))
    await asyncio.wait_for(task, 1)
    assert socket.connects == 1
    assert socket.configs == []
    assert socket.finished.is_set()


def during_startup(stage, disconnect):
    async def scenario(socket, carrier, task, tools):
        gate = socket.connect_gate if stage == "connect" else socket.config_gate
        gate.clear()
        await carrier.deliver("start", streamSid="MZ-test")
        await socket.entered.wait()
        await carrier.deliver("start", streamSid="duplicate")
        await carrier.deliver("media", media={"payload": "too-early"})
        assert socket.audio == []
        assert socket.connects == 1
        message = WebSocketDisconnect() if disconnect else {"event": "stop"}
        await carrier.incoming.put((message, None))
        await asyncio.wait_for(task, 1)
        gate.set()
        await asyncio.sleep(0)
        assert socket.configs == []
        if stage == "config":
            assert socket.finished.is_set()
            assert socket.listening_done.is_set()

    return scenario


async def listener_disconnect_during_shutdown(socket, carrier, task, tools):
    async def disconnected_listener():
        await socket.ready.wait()
        try:
            raise WebSocketDisconnect()
        finally:
            socket.listening_done.set()

    with patch.object(socket, "start_listening", disconnected_listener):
        await carrier.deliver("start", streamSid="MZ-test")
        await asyncio.wait_for(socket.listening_done.wait(), 1)
        await carrier.incoming.put(({"event": "stop"}, None))
        await asyncio.wait_for(task, 1)
    assert socket.finished.is_set()


def queued_audio_shutdown(ending, stalled=False):
    async def scenario(socket, carrier, task, tools):
        sending = asyncio.Event()
        release = asyncio.Event()
        cancelled = asyncio.Event()

        async def slow_send(chunk):
            sending.set()
            try:
                await release.wait()
                socket.audio.append(chunk)
            except asyncio.CancelledError:
                cancelled.set()
                raise

        with patch.object(socket, "send_audio_chunk", slow_send):
            await carrier.deliver("start", streamSid="MZ-test")
            await socket.ready.wait()
            await carrier.deliver("media", media={"payload": "first"})
            await sending.wait()
            await carrier.deliver("media", media={"payload": "last"})
            message = (
                WebSocketDisconnect() if ending == "disconnect" else {"event": ending}
            )
            await carrier.incoming.put((message, None))
            if stalled:
                await asyncio.wait_for(task, 2)
                assert cancelled.is_set()
                assert socket.audio == []
            else:
                # Shutdown must wait for the in-flight send and queued final chunk.
                done, _ = await asyncio.wait({task}, timeout=0.02)
                assert not done
                release.set()
                await asyncio.wait_for(task, 1)
                assert [chunk.audio for chunk in socket.audio] == ["first", "last"]
                assert not cancelled.is_set()
        assert socket.finished.is_set()
        assert socket.listening_done.is_set()

    return scenario


def test_scenario(path, scenario):
    async def run(self):
        socket = await self.exercise(path, scenario)
        if socket.configs:
            self.assertTrue(socket.finished.is_set())
            self.assertTrue(socket.listening_done.is_set())

    return run


for example in ("03-conversation-websocket", "04-conversation-websocket-tools"):
    path = f"{example}/python/server.py"
    for scenario in (
        normal,
        carrier_first,
        close_before_start,
        stop_before_start,
        listener_disconnect_during_shutdown,
    ):
        setattr(
            StartTests,
            f"test_{example[:2]}_{scenario.__name__}",
            test_scenario(path, scenario),
        )
    for ending in ("stop", "closed", "disconnect"):
        for stalled in (False, True):
            setattr(
                StartTests,
                f"test_{example[:2]}_drain_{ending}_stalled_{stalled}",
                test_scenario(path, queued_audio_shutdown(ending, stalled)),
            )
    for stage in ("connect", "config"):
        for disconnect in (False, True):
            setattr(
                StartTests,
                f"test_{example[:2]}_{stage}_disconnect_{disconnect}",
                test_scenario(path, during_startup(stage, disconnect)),
            )


class ToolTests(unittest.IsolatedAsyncioTestCase):
    exercise = StartTests.exercise

    async def test_tool_call_id(self):
        async def immediate_thread(fn, **kwargs):
            return fn(**kwargs)

        async def scenario(socket, carrier, task, tools):
            await carrier.deliver("start", streamSid="MZ-test")
            await socket.ready.wait()
            await socket.emit(
                type="tool_call",
                tool_call_id="tool-test",
                parameters={
                    "date": "2027-01-01",
                    "from_airport": "BOS",
                    "to_airport": "SFO",
                },
            )
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            self.assertEqual(len(tools), 1)
            self.assertEqual(socket.output[0].tool_call_id, "tool-test")

        with patch.object(asyncio, "to_thread", immediate_thread):
            await self.exercise(
                "04-conversation-websocket-tools/python/server.py", scenario
            )


if __name__ == "__main__":
    unittest.main()

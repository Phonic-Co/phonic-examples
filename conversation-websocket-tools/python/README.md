# Conversations via WebSocket

This example walks you through the process of running a conversation via WebSocket, using simultaneous connections with Twilio and Phonic.

## 📋 Prerequisites

Follow the setup instructions [here](https://github.com/Phonic-Co/phonic-examples/python).

## 🚀 Run Steps

### 1. Update `.env.local`

Replace the phone numbers and ngrok URL with the correct values (see the guide for more information).

### 2. Create a tool and agent

```bash
uv run python create_tool.py
uv run python create_agent.py
```

### 3. Run the server

```bash
uv run python server.py
```

### 4. Make an outbound call

```bash
uv run python outbound_call.py
```

### 3. Make an inbound call

Grab the agent's phone number on the [Agents page](https://phonic.co/agents), and give it a call!

## 📄 License

[MIT](../../LICENSE)
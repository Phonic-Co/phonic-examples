# Conversations via WebSocket

This example walks you through the process of running a conversation via WebSocket, using simultaneous connections with Twilio and Phonic.

## 📋 Prerequisites

Follow the setup instructions [here](https://github.com/Phonic-Co/phonic-examples/python).

## 🚀 Run Steps

### 1. Update `constants.py`

Replace the phone numbers and ngrok URL with the correct values (see the guide for more information).

### 2. Create an agent

```bash
python create_agent.py
```

### 3. Run the server

```bash
fastapi dev server.py --port 8080
```

### 4. Make an outbound call

```bash
python outbound_call.py
```

### 3. Make an inbound call

Grab the agent's phone number on the [Agents page](https://phonic.co/agents), and give it a call!

## 📄 License

[MIT](../../LICENSE)
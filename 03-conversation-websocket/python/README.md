# Conversation WebSocket Example (Python)

## 1. Setup

Clone the repository and install packages:
```bash
cd phonic-examples/conversation-websocket/python
uv sync
```

Follow the ngrok setup instructions [here](https://github.com/Phonic-Co/phonic-examples/blob/main/ngrok_tunneling.md).
Retrieve your Twilio credentials following
[this](https://www.twilio.com/docs/voice/tutorials/how-to-make-outbound-phone-calls/python#retrieve-your-twilio-account-credentials).

### 2. Configure Environment

Create an `.env.local` file and fill it with:
```dotenv
PHONIC_API_KEY="ph_..."
NGROK_URL="https://your-ngrok-url.ngrok-free.app"
TWILIO_PHONE_NUMBER="+15551234567"
CUSTOMER_PHONE_NUMBER="+15551234567"
TWILIO_ACCOUNT_SID="your sid"
TWILIO_AUTH_TOKEN="your auth token"
```
Both phone numbers must include the leading `+` and country code, and must not contain dashes or spaces.

## 3. Create an agent

First, create a Phonic agent:
```bash
uv run create_agent.py
```

## 4. Start the server

```bash
uv run server.py
```

## 5. Make an outbound call

```bash
uv run outbound_call.py
```

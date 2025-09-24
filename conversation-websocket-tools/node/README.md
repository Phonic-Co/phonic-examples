# Conversation WebSocket Tools Example (Node)

## 1. Setup

Clone the repository and install packages:
```bash
cd phonic-examples/conversation-websocket-tools/node
npm install
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

### 3. Create an agent

First, create a Phonic agent:

```bash
npm run create-agent
```

### 2. Start the server

Start the WebSocket server:

```bash
npm run start
```

### 3. Make an outbound call

In a new terminal, make an outbound call:

```bash
npm run outbound-call
```

### 4. Make an inbound call

Simply call your Twilio phone number.

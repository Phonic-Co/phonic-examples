# Conversation WebSocket Example

This example demonstrates how to use Phonic's conversation API with WebSockets in Node.js, integrating with Twilio for phone calls.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the `node` directory with your credentials:
   ```
   PHONIC_API_KEY=your_phonic_api_key
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   ```

3. Update the constants in `env-vars.ts`:
   - `ngrokUrl`: Your ngrok URL (without https://)
   - `twilioPhoneNumber`: Your Twilio phone number
   - `customerPhoneNumber`: The phone number to call

## Usage

### 1. Create an agent

First, create a Phonic agent:

```bash
tsx create-agent.ts
```

### 2. Start the server

Start the WebSocket server:

```bash
tsx server.ts
```

### 3. Make an outbound call

In a new terminal, make an outbound call:

```bash
tsx outbound-call.ts
```

### 4. Make an inbound call

Simply call your Twilio phone number.

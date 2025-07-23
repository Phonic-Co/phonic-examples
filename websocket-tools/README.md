# WebSocket tools example

This example demonstrates how to use Phonic agents with WebSocket tools by creating a WebSocket connection between your Twilio account and Phonic.

You will be able to call your agent's phone number and have a conversation by invoking sync and async WebSocket tools.

## 📋 Prerequisites

- [Node.js](https://nodejs.org) (v22 or higher recommended)
- [Twilio](https://www.twilio.com) account with a configured phone number
- [Phonic](https://phonic.co) API key for voice processing
- [ngrok](https://ngrok.com) account for secure tunneling

Follow the [WebSocket tools guide](https://docs.phonic.co/guides/websocket_tools) to create an agent with two tools.

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Phonic-Co/phonic-examples
cd phonic-examples/websocket-tools
npm install
```

### 2. Configure Environment

1. Obtain a Phonic API Key by visiting the [Phonic API Keys](https://phonic.co/api-keys) page and creating an API key.
2. Create an `.env.local` file in the example root with the following content:
```
PHONIC_API_KEY="your_api_key"  # starts with ph_
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
```

### 3. Set Up ngrok Tunnel

Start ngrok to expose your local server to the internet:

```bash
ngrok http 3000
```

### 4. Configure Twilio Phone Number

1. Navigate to the Twilio [Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming) page
2. Select your phone number
3. Under **Voice Configuration**:
   - Set **When a call comes in** to **Webhook**
   - Set the URL to `https://YOUR_NGROK_HOST/inbound`
   - Set the HTTP method to **HTTP POST**
   - Save your changes

<img width="1387" alt="Example Twilio Setup" src="https://github.com/user-attachments/assets/f8b5ea16-8c01-4d7f-bdf4-04c128fc2c53" />

### 5. Launch the Application

Start the application server:

```bash
npm run start
```

Now, you can call your Twilio phone number and have a conversation with the Phonic agent.

Try the following:
* Ask for the current time in London. You should get an answer immediately.
* Ask for the current temperature in London. The agent won't know immediately, but if you ask it 3 seconds later, it will know!

## 📄 License

[MIT](LICENSE)

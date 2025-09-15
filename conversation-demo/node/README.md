# Phonic Conversation Demo

![Phonic API](https://img.shields.io/badge/Phonic%20API-Enabled-blue)
![Twilio](https://img.shields.io/badge/Twilio-Integrated-red)
![License](https://img.shields.io/badge/License-MIT-green)

A production-ready application that connects Twilio phone calls to the Phonic API using the Phonic Node.js SDK, enabling interactive voice conversations with AI.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v22 or higher recommended)
- [Twilio](https://www.twilio.com/) account with a configured phone number
- [Phonic](https://phonic.co/) API key for voice processing
- [ngrok](https://ngrok.com/) account for secure tunneling

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Phonic-Co/phonic-conversation-demo
cd phonic-conversation-demo
npm install
```

### 2. Configure Environment

1. Obtain a Phonic API Key by visiting the [Phonic API Keys](https://phonic.co/api-keys) page and creating an API key. If you see the "Coming Soon" page when you click the link, just refresh!
2. Create a `.env.local` file in the project root with the following contents:
```
PHONIC_API_KEY="your_api_key"  # starts with ph_

# Needed if you'd like to receive a call
NGROK_URL="..."
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="..."  # e.g. +19189391234
USER_PHONE_NUMBER="..."    # e.g. +19189395678

# Needed if you'd like to use webhooks
PHONIC_WEBHOOK_SECRET="your_webhook_signing_secret"  # starts with whsec_

# Used to secure /webhooks/phonic-config
PHONIC_CONFIG_WEBHOOK_AUTHORIZATION="your_configuration_endpoint_authorization"
```

### 3. Set Up ngrok Tunnel

Start ngrok to expose your local server to the internet:

```bash
ngrok http 3000
```

### 4. Configure Twilio Webhook

1. Navigate to the Twilio [Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming) page
2. Select your phone number
3. Under **Voice Configuration**:
   - Set **When a call comes in** to **Webhook**
   - Set the URL to `https://YOUR_NGROK_HOST/inbound`
   - Set the HTTP method to **HTTP POST**
   - Save your changes

<img width="1387" alt="Example Twilio Setup" src="https://github.com/user-attachments/assets/f8b5ea16-8c01-4d7f-bdf4-04c128fc2c53" />


### 5. Launch the Application

Start the application server with hot reloading:

```bash
npm run dev
```

You should see output indicating that the server is running on port 3000.

Now, you have two options to start a conversation:

1. Call the phone number you configured in Twilio
2. Receive a call on `USER_PHONE_NUMBER` by running `npm run call` in another terminal.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

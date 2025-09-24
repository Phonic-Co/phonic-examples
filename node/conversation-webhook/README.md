# Conversation Webhook Example

This example demonstrates how to create a Phonic agent that uses:

- **Webhook Configs**: Calls your local server endpoint to get a dynamic config
- **Custom Webhook Tools**: Tool execution via webhooks  
- **Event Webhooks**: Sends conversation events to your local server

The agent that you will create will hit the `/webhooks/phonic-config` endpoint to override it's default configuration. When you make an outbound call and confirm that you will visit a destination, your server will be called via the `/webhooks/add-destination` endpoint. After the conclusion of the call, your server will recieve a conversation.ended and a conversation.analysis webhook.

## 1. Prerequisites

- Node.js installed
- [Phonic](https://phonic.co) API key for voice processing
- [ngrok](https://ngrok.com) for exposing your local server to the internet

## 2. Setup

### 2.1 Install Dependencies

```bash
cd phonic-examples/node
npm install
```

Install and run ngrok to expose port 3000:

```bash
npm install -g ngrok
ngrok http 3000
```

### 2.2 Enable Webhook Events

Enable webhook events in the Phonic UI. Navigate to the [Webhooks](https://phonic.co/webhooks) page and click on the "Create Webhook" button, subscribing to the following events:

- conversation.analysis
- conversation.ended

### 2.3 Configure Environment

Create an `.env.local` file in the example root with:

```dotenv
PHONIC_API_KEY="your_api_key"
PHONIC_WEBHOOK_SECRET="your_webhook_secret" // Found in the Webhooks tab in the Phonic UI
PHONIC_CONFIG_WEBHOOK_AUTHORIZATION="Bearer your_auth_key"
NGROK_URL="https://your-ngrok-url.ngrok.io" // Your server's public URL
```

Copy the public URL (e.g., `https://abc123.ngrok.io`) and add it to your `.env.local` as `NGROK_URL`.

## 4. Start the Webhook Server

```bash
npm run conversation-webhook:dev
```

This starts a server with three endpoints:

- `/webhooks/phonic-config`: Configuration endpoint for dynamic agent configuration
- `/webhooks/events`: Receives conversation webhook events from Phonic
- `/webhooks/add-destination`: Custom webhook tool endpoint

## 5. Make an Outbound Call

Update `YOUR_PHONE_NUMBER` in `outbound-call.ts`, then run:

```bash
npm run conversation-webhook:outbound-call
```

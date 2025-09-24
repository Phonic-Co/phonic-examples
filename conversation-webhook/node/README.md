# Conversation Webhook Example (Node)

This example demonstrates how to create a Phonic agent that uses:

- **Webhook Configs**: Calls your local server endpoint to get a dynamic config
- **Custom Webhook Tools**: Tool execution via webhooks
- **Event Webhooks**: Sends conversation events to your local server

In this example, we will help you both create the agent and a simple Hono API server that will handle the webhook requests.

The agent that you will create will hit the `/webhooks/phonic-config` endpoint to override its default configuration. When you make an outbound call and confirm that you will visit a destination, your server will be called via the `/webhooks/add-destination` endpoint. After the conclusion of the call, your server will recieve a conversation.ended and a conversation.analysis webhook.

We demonstrate using an Authorization header to secure the `/webhooks/phonic-config` endpoint. This is set using the `PHONIC_CONFIG_WEBHOOK_AUTHORIZATION` environment variable, which you provide as part of your agent definition and will be checked by the Hono API endpoint.

## 1. Prerequisites

- Node.js installed
- [Phonic](https://phonic.co) API key for voice processing
- [ngrok](https://ngrok.com) for exposing your local server to the internet

## 2. Setup

### 2.1 Install Dependencies

Navigate to the conversation webhook example directory:
```bash
cd phonic-examples/conversation-webhook/node
```

Install dependencies using npm:
```bash
npm install
```

Follow the ngrok setup instructions [here](https://github.com/Phonic-Co/phonic-examples/blob/main/ngrok_tunneling.md).

### 2.2 Enable Webhook Events

Enable webhook events in the Phonic UI. Navigate to the [Webhooks](https://phonic.co/webhooks) page and click on the "Create Webhook" button, subscribing to the following events:

- conversation.analysis
- conversation.ended

Copy the Webhook Signing Secret, which will be used to verify that the webhook requests are coming from Phonic.

In the endpoint field, type in your ngrok URL, followed by `/webhooks/events`.

### 2.3 Configure Environment

Create an `.env.local` file and fill it with:
```dotenv
PHONIC_API_KEY="ph_..."
PHONIC_WEBHOOK_SIGNING_SECRET="whsec_..." # Found in the Webhooks tab in the Phonic UI
PHONIC_CONFIG_WEBHOOK_AUTHORIZATION="Bearer your_auth_key" # Authorization key to secure the /webhooks/phonic-config endpoint
NGROK_URL="https://your-ngrok-url.ngrok-free.app"
CUSTOMER_PHONE_NUMBER="+15551234567" # The phone number to call
```
Your phone number must include the leading `+` and country code, and must not contain dashes or spaces.

## 3. Create the Agent

First, create the Phonic agent and tool:
```bash
npm run create-agent
```

This creates an agent with a custom webhook tool that will call your server.

## 4. Start the Webhook Server

```bash
npm run dev
```

This starts a server with three endpoints:

- `/webhooks/phonic-config`: Configuration endpoint for dynamic agent configuration
- `/webhooks/events`: Receives conversation webhook events from Phonic
- `/webhooks/add-destination`: Custom webhook tool endpoint

## 5. Make an Outbound Call

```bash
npm run outbound-call
```

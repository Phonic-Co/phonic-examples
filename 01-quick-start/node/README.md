# Quick Start example

This example walks you through creating a simple agent and making both outbound and inbound calls.
It complements the [Quick Start guide](https://docs.phonic.co/docs/get-started/quick-start).

## 📋 Prerequisites

This repository uses [Node.js](https://nodejs.org) (v22 or higher recommended).
To get started, clone the repo and install packages:
```bash
git clone https://github.com/Phonic-Co/phonic-examples
cd phonic-examples/quick-start/node
npm install
```

To set up your environment variables:
1. Obtain a Phonic API Key by visiting the [Phonic API Keys](https://phonic.co/api-keys) page and creating an API key.
2. Create an `.env.local` file with the following content:
```dotenv
PHONIC_API_KEY="your_api_key"
CUSTOMER_PHONE_NUMBER="your_phone_number"  // e.g., +15551234567
```
Your phone number must include the leading `+` and country code, and must not contain dashes or spaces.

## 🚀 Run steps

### 1. Create an agent

```bash
npm run create-agent
```

### 2. Make an outbound call

```bash
npm run outbound-call
```

### 5. Make an inbound call

Grab the agent's phone number on the [Agents page](https://phonic.co/agents), and give it a call!

## 📄 License

[MIT](../../LICENSE)

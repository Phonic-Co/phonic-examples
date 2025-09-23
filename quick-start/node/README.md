# Quick Start example

This example walks you through creating a simple agent and making both outbound and inbound calls. It complements the [Quick Start guide](https://docs.phonic.co/guides/quick_start).

## 📋 Prerequisites

- [Node.js](https://nodejs.org) (v22 or higher recommended)
- [Phonic](https://phonic.co) API key for voice processing

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Phonic-Co/phonic-examples
cd phonic-examples/quick-start/node
npm install
```

### 2. Configure Environment

1. Obtain a Phonic API Key by visiting the [Phonic API Keys](https://phonic.co/api-keys) page and creating an API key.
2. Create an `.env.local` file in the example root with the following content:
```
PHONIC_API_KEY="your_api_key"
```

### 3. Create an agent

```bash
npm run create-agent
```

### 4. Make an outbound call

Open `outbound-call.ts`, update `YOUR_PHONE_NUMBER` to your phone number, and run:

```bash
npm run outbound-call
```

### 5. Make an inbound call

Grab the agent's phone number on the [Agents page](https://phonic.co/agents), and give it a call!

## 📄 License

[MIT](LICENSE)

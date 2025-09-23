# Quick Start example

This example walks you through creating a simple agent and making both outbound and inbound calls. It complements the [Quick Start guide](https://docs.phonic.co/guides/quick_start).

## 📋 Prerequisites

- [uv](https://docs.astral.sh/uv/) for package management.

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Phonic-Co/phonic-examples
cd phonic-examples/quick-start/python
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

### 2. Configure Environment

1. Obtain a Phonic API Key by visiting the [Phonic API Keys](https://phonic.co/api-keys) page and creating an API key.
2. Create an `.env.local` file in the example root with the following content:
```dotenv
PHONIC_API_KEY="your_api_key"
```

### 3. Create an agent

```bash
python create_agent.py
```

### 4. Make an outbound call

Open `outbound_call.py`, update `YOUR_PHONE_NUMBER` to your phone number, and run:

```bash
python outbound_call.py
```

### 5. Make an inbound call

Grab the agent's phone number on the [Agents page](https://phonic.co/agents), and give it a call!

## 📄 License

[MIT](../../LICENSE)

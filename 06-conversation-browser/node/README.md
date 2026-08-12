# Live Conversation Browser Example (Node.js)

This example connects a browser to an active conversation’s live WebSocket and
plays its authenticated HLS audio while displaying the live transcript.

## Setup

Create `.env.local` in this directory:

```dotenv
PHONIC_API_KEY="ph_..."
```

Install dependencies and start the local preview server:

```bash
npm install
npm start
```

Open `http://localhost:3000`, enter an active conversation ID, and click
Connect. The server mints a short-lived session token and keeps the API key
out of browser code.

The HLS playlist and each segment are authenticated through the local proxy.
The session token is intentionally short-lived and appears in proxied HLS URLs;
the permanent API key is never sent to the browser.

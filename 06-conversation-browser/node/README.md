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

## Before you copy this into production

The token is minted with `conversation_ids`, so it covers only the conversation
it was requested for.

Two things this example does not do, which you must:

1. **Authorize the request.** `POST /session-token` here mints a token for any
   caller. Confirm from your own session that the conversation belongs to the
   person asking before creating the token — Phonic enforces *which*
   conversation a token may read, not *whose* it is.
2. **Keep the token off the browser if you can.** This example hands it to the
   page so the browser can open the live WebSocket directly. Since the local
   server already proxies the HLS requests, a stricter version attaches the
   token server-side and proxies the WebSocket too, so the browser never holds
   a Phonic credential at all.

Session tokens receive a reduced payload on the live WebSocket. It carries only
`id`, `external_id`, `origin`, `agent`, `items`, `text`, `summary`,
`duration_ms`, `started_at`, `ended_at`,
`assistant_end_conversation_signal_at` and `is_live` — every other field of the
conversation is absent, not null. Access tokens and API keys still receive the
full object.

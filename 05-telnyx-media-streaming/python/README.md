# Telnyx Media Streaming Example (Python)

Bridge a Telnyx call to a Phonic agent over WebSockets and verify that audio
flows **both** directions: caller → Phonic (transcription) and Phonic → caller
(the agent's voice).

> **If the agent can't be heard, jump to [Troubleshooting](#troubleshooting).**
> 99% of the time it's that Telnyx bidirectional streaming was never turned on.

> **Media streaming vs. SIP trunking.** This example uses Telnyx *media
> streaming*: the call's audio is forked over a WebSocket to this server, which
> relays it to Phonic. That is different from *SIP trunking*, where you point a
> Telnyx SIP trunk directly at Phonic's SIP URI and Phonic handles the RTP
> itself with no bridge. Use this example when your own code touches the audio.
> If you instead want a SIP trunk straight into Phonic, you don't need this repo
> — see Phonic's `add-custom-phone-number` and `/conversations/sip/outbound_call`
> APIs.

## How it works

```
Caller  ⇄  Telnyx  ⇄  this server (/ws)  ⇄  Phonic agent
```

- **Inbound** calls hit `/inbound`, which returns TeXML telling Telnyx to open a
  bidirectional media stream to `/ws`.
- **Outbound** calls are placed with the Call Control API (`outbound_call.py`);
  the server starts the bidirectional stream on the `call.answered` webhook.
- `/ws` relays caller audio to Phonic and Phonic's audio back to Telnyx.

`PCMU` (8 kHz μ-law) is the same thing Phonic calls `mulaw_8000`.

## 1. Setup

```bash
cd phonic-examples/05-telnyx-media-streaming/python
uv sync
```

> **Note:** These examples pin Python 3.11 via `.python-version`. If it isn't
> installed, run `uv python install 3.11`. (Newer Python versions can fail to
> build `pydantic-core` from source.)

Follow the ngrok setup instructions
[here](https://github.com/Phonic-Co/phonic-examples/blob/main/ngrok_tunneling.md).
The server listens on `3000` by default — run `ngrok http 3000`, or set `PORT`
to match your tunnel. **The ngrok port and the server port must agree**, or
nothing reaches your code. A reserved ngrok domain (`ngrok http --domain=…`)
saves you from re-editing the webhook URL every restart.

## 2. Configure environment

Create an `.env.local` file:

```dotenv
PHONIC_API_KEY="ph_..."
NGROK_URL="https://your-ngrok-url.ngrok-free.app"
TELNYX_API_KEY="KEY..."

# Optional — defaults to 3000:
PORT="3000"

# Only needed for outbound_call.py:
TELNYX_CONNECTION_ID="your Voice API / Call Control connection id"
TELNYX_PHONE_NUMBER="+15551234567"
CUSTOMER_PHONE_NUMBER="+15551234567"
```

Phone numbers must include the leading `+` and country code, no dashes or
spaces.

## 3. Point Telnyx at your server

Telnyx starts a media stream from either a TeXML application or a Voice API
(Call Control) application. Pick whichever your number is already on.

### Option A — TeXML application (drives the inbound flow here)

1. In the Telnyx portal, create a **TeXML Application**.
2. Set its **Voice Method** webhook (inbound) to `{NGROK_URL}/inbound` (GET or
   POST — the endpoint accepts both).
3. Assign your phone number to this application.

### Option B — Voice API / Call Control application (outbound)

For `outbound_call.py` you need a **Voice API application** (its id is
`TELNYX_CONNECTION_ID`), and `TELNYX_PHONE_NUMBER` must be able to place calls
on it. You do **not** need to configure the app's webhook in the portal — the
dial request sets a per-call `webhook_url` pointing at `/call-control`.

The flow: dial (`outbound_call.py`) → Telnyx posts `call.answered` to
`/call-control` → the server issues `streaming_start` with
`stream_bidirectional_mode: "rtp"`. Streaming is started **after** answer on
purpose: putting the stream params on the dial request forks the audio but does
**not** establish the bidirectional return path, so the caller hears nothing.

## 4. Create the agent

```bash
uv run create_agent.py
```

## 5. Start the server

```bash
uv run server.py
```

## 6. Make a call

- **Inbound:** call your Telnyx number.
- **Outbound:** `uv run outbound_call.py`.

## Verifying audio flows both ways

The server prints a live counter every 2 seconds:

```
[audio] Telnyx->Phonic: 143 frames | Phonic->Telnyx: 98 frames
```

- **`Telnyx->Phonic` climbing while you speak** → inbound audio is reaching
  Phonic.
- **`Phonic->Telnyx` climbing while the agent speaks** → we're sending the
  agent's audio to Telnyx.
- **`Phonic->Telnyx` climbing but you hear nothing** → frames are leaving the
  server but Telnyx is dropping them → the bidirectional-mode problem below.

## Porting from a Twilio integration? Read this first

Telnyx's media streaming looks Twilio-compatible but differs in ways that cause
silent, one-way, or dead audio. If you copied a Twilio bridge, check these:

| | Twilio | Telnyx |
| --- | --- | --- |
| Enable return audio | automatic with `<Connect><Stream>` | **must** set `bidirectionalMode="rtp"` |
| Frame you send back | `{event, streamSid, media:{payload}}` | `{event:"media", media:{payload}}` — **no** stream id |
| Stream id field (inbound) | `streamSid` | `stream_id` |
| Media `track` value | `"inbound"` | `"inbound_track"` — so don't filter on `"inbound"` |
| `track="..."` on the stream | fine | **omit it** on a bidirectional `<Connect><Stream>` — it stops inbound audio |

## Troubleshooting

### Agent can't be heard (Phonic → Telnyx audio missing)

1. **Bidirectional mode is off.** The stream must set `bidirectionalMode="rtp"`
   (TeXML) / `stream_bidirectional_mode: "rtp"` (Call Control). Without it Telnyx
   accepts the WebSocket but silently discards everything you send back.
2. **Codec mismatch.** `bidirectionalCodec` / `stream_bidirectional_codec` must
   be `PCMU`, and the agent's `output_format` must be `mulaw_8000`.
3. **Wrong outbound frame shape.** Send exactly
   `{"event":"media","media":{"payload":"<base64 PCMU>"}}` — no `streamSid`.

### Caller can't be heard (`Telnyx->Phonic` counter stuck at 0)

1. **A `track="..."` attribute on the `<Connect><Stream>`.** `track` belongs to
   the unidirectional `<Start><Stream>` fork; on a bidirectional
   `<Connect><Stream>` it makes Telnyx stop forwarding the caller's audio — you
   receive `connected`/`start`/`stop` but **zero** `media` events. Remove it.
2. **Filtering on `media.track == "inbound"`.** Telnyx sends `"inbound_track"`,
   so a Twilio-style filter drops every frame. This example forwards all media.
3. **`conversation_created` was dropped.** Don't gate media handling on the
   Telnyx `stream_id` — `conversation_created` from Phonic can arrive before
   Telnyx's `start`, and dropping it stalls inbound forwarding. This example
   only gates the *outgoing* audio on `stream_id`.
4. **`input_format` mismatch** — must be `mulaw_8000` to match the PCMU stream.

### Call fast-busies / nothing reaches the server

- **ngrok/port mismatch or a stale webhook URL.** ngrok subdomains rotate on
  every restart; the TeXML app's webhook must point at the *current* URL, and
  the ngrok port must match the server `PORT`. Confirm with
  `curl -i https://<ngrok>/inbound` — you should get the `<Response>` XML.
- **Trial account restrictions.** Telnyx trials only allow calls to/from
  **verified** numbers, or you get a fast-busy before any webhook fires.
- **Number not on the right connection.** The number must be assigned to your
  **TeXML application**, not a SIP connection.

## References

- [Telnyx: Media Streaming over WebSockets](https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming)
- [Telnyx: bi-directional streaming support](https://telnyx.com/release-notes/bi-directional-streaming-support)
- [Telnyx TeXML `<Stream>` verb](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/stream)
- [Telnyx: Streaming start (Call Control)](https://developers.telnyx.com/api/call-control/start-call-streaming)

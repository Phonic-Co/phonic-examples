# Telnyx + SIP Trunking Example (Node)

Bridge a Telnyx call to a Phonic agent over WebSockets and verify that audio
flows **both** directions: caller → Phonic (transcription) and Phonic → caller
(the agent's voice).

> **If the agent can't be heard, jump to [Troubleshooting](#troubleshooting).**
> 99% of the time it's that Telnyx bidirectional streaming was never turned on.

## How it works

```
Caller  ⇄  Telnyx  ⇄  this server (/ws)  ⇄  Phonic agent
```

- **Inbound** calls hit `POST /inbound`, which returns TeXML telling Telnyx to
  open a bidirectional media stream to `/ws`.
- **Outbound** calls are placed with the Call Control API (`outbound-call.ts`),
  which starts the same bidirectional stream in the dial request.
- `/ws` relays caller audio to Phonic and Phonic's audio back to Telnyx.

The one thing that matters for return audio: **Telnyx only plays audio you send
back if the stream was started in bidirectional mode.** By default a media
stream is inbound-only.

| Direction            | TeXML (`server.ts`)          | Call Control (`outbound-call.ts`) |
| -------------------- | ---------------------------- | --------------------------------- |
| Enable return audio  | `bidirectionalMode="rtp"`    | `stream_bidirectional_mode: "rtp"`|
| Codec (must be PCMU) | `bidirectionalCodec="PCMU"`  | `stream_bidirectional_codec: "PCMU"` |

`PCMU` (8 kHz μ-law) is the same thing Phonic calls `mulaw_8000`.

## 1. Setup

```bash
cd phonic-examples/05-telnyx-sip-trunking/node
npm install
```

Follow the ngrok setup instructions
[here](https://github.com/Phonic-Co/phonic-examples/blob/main/ngrok_tunneling.md)
(use port `3000`).

## 2. Configure environment

Create an `.env.local` file:

```dotenv
PHONIC_API_KEY="ph_..."
NGROK_URL="https://your-ngrok-url.ngrok-free.app"
TELNYX_API_KEY="KEY..."

# Only needed for outbound-call.ts:
TELNYX_CONNECTION_ID="your Voice API / Call Control connection id"
TELNYX_PHONE_NUMBER="+15551234567"
CUSTOMER_PHONE_NUMBER="+15551234567"
```

Phone numbers must include the leading `+` and country code, no dashes or
spaces.

## 3. Point Telnyx at your server

You'll use one of two connection types depending on how you're set up.

### Option A — TeXML application (mirrors the inbound flow here)

1. In the Telnyx portal, create a **TeXML Application**.
2. Set its **Voice Method** webhook (inbound) to `POST {NGROK_URL}/inbound`.
3. Assign your phone number (or SIP trunk's inbound routing) to this
   application.

### Option B — SIP trunk / Voice API (Call Control)

If your number lives on a **SIP Connection / Voice API** application, you drive
streaming from Call Control instead of TeXML. `outbound-call.ts` shows the exact
dial request; for inbound you'd answer the call and issue a `streaming_start`
command with the same `stream_bidirectional_mode` / `stream_bidirectional_codec`
fields.

## 4. Create the agent

```bash
npm run create-agent
```

## 5. Start the server

```bash
npm run start
```

## 6. Make a call

- **Inbound:** call your Telnyx number.
- **Outbound:** `npm run outbound-call`.

## Verifying audio flows both ways

The server prints a live counter every 2 seconds:

```
[audio] Telnyx->Phonic: 143 frames | Phonic->Telnyx: 98 frames
```

- **`Telnyx->Phonic` climbing while you speak** → inbound audio is reaching
  Phonic. If this stays at 0, Telnyx isn't streaming caller audio to you (check
  the webhook / stream URL and that the call actually connected).
- **`Phonic->Telnyx` climbing while the agent speaks** → Phonic is producing
  audio and we're sending it to Telnyx.
- **`Phonic->Telnyx` climbing but you hear nothing** → the frames are leaving
  the server but Telnyx is dropping them. This is the bidirectional-mode
  problem below.

## Troubleshooting

### Agent can't be heard (audio from Phonic → Telnyx)

In order of likelihood:

1. **Bidirectional mode is off.** The stream must be started with
   `bidirectionalMode="rtp"` (TeXML) or `stream_bidirectional_mode: "rtp"`
   (Call Control). Without it, Telnyx accepts your WebSocket but silently
   discards outbound media. This is the single most common cause.
2. **Codec mismatch.** `bidirectionalCodec` / `stream_bidirectional_codec` must
   be `PCMU`, and the Phonic agent's `output_format` must be `mulaw_8000`. A
   mismatch produces silence or static, not an error.
3. **Wrong outbound frame shape.** The frame you send back must be exactly
   `{"event":"media","media":{"payload":"<base64 PCMU>"}}`. Do **not** copy the
   Twilio format — Telnyx does not want a `streamSid`/`stream_id` on the media
   frames you send, and the caller-audio field is `stream_id` (snake_case), not
   `streamSid`.
4. **You started the stream with `<Start>` instead of `<Connect>`, or set the
   track wrong.** Use `<Connect><Stream>` for a full-duration agent.

### Caller can't be heard (audio from Telnyx → Phonic)

- `Telnyx->Phonic` counter stuck at 0: confirm the media `track` is `inbound`
  and that `conversation_created` arrived from Phonic before audio is forwarded
  (the server already guards on both).
- Confirm `input_format: "mulaw_8000"` in the Phonic config matches the PCMU the
  stream delivers.

### Nothing connects at all

- ngrok URL in `NGROK_URL` / the TeXML app must match the currently running
  tunnel, and use `wss://` for the stream URL (the code derives this for you).
- Check the Telnyx **Debugging → WebSocket / Call** logs in the portal for
  handshake or codec errors.

## References

- [Telnyx: Media Streaming over WebSockets](https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming)
- [Telnyx: bi-directional streaming support](https://telnyx.com/release-notes/bi-directional-streaming-support)
- [Telnyx TeXML `<Stream>` verb](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/stream)
- [Telnyx: Streaming start (Call Control)](https://developers.telnyx.com/api/call-control/start-call-streaming)

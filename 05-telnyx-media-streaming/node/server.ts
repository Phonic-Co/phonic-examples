import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { type Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import { type Phonic, PhonicClient } from "phonic";
import { phonicApiKey, port, telnyxApiKey } from "./env-vars";
import type { TelnyxWebSocketMessage } from "./types";

const app = new Hono();
const phonicClient = new PhonicClient({
  apiKey: phonicApiKey,
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// bidirectionalMode="rtp" is what lets us send the agent's audio back to the
// caller; bidirectionalCodec must match the agent's audio_format (PCMU ==
// mulaw_8000). Don't add a track="..." attribute — on a bidirectional
// <Connect><Stream> it stops Telnyx forwarding the caller's inbound audio.
// Registered for GET and POST to match either "Voice Method" on the app.
const inboundHandler = (c: Context) => {
  const url = new URL(c.req.url);
  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${url.host}/ws" bidirectionalMode="rtp" bidirectionalCodec="PCMU" />
  </Connect>
</Response>`;

  return c.text(texml, 200, { "Content-Type": "application/xml" });
};

app.get("/inbound", inboundHandler);
app.post("/inbound", inboundHandler);

// Outbound calls (see outbound-call.ts): start the stream on answer. This must
// use streaming_start after answer — stream params on the dial request don't
// establish the return-audio path.
app.post("/call-control", async (c) => {
  const url = new URL(c.req.url);
  const body = (await c.req.json()) as {
    data?: { event_type?: string; payload?: { call_control_id?: string } };
  };
  const callControlId = body.data?.payload?.call_control_id;

  if (body.data?.event_type === "call.answered" && callControlId) {
    const response = await fetch(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/streaming_start`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${telnyxApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stream_url: `wss://${url.host}/ws`,
          stream_bidirectional_mode: "rtp",
          stream_bidirectional_codec: "PCMU",
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `streaming_start failed: ${response.status}`,
        await response.text(),
      );
    }
  }

  return c.body(null, 200);
});

app.get(
  "/ws",
  upgradeWebSocket(() => {
    let phonicSocket: Awaited<
      ReturnType<typeof phonicClient.conversations.connect>
    > | null = null;
    let streamId: string | null = null;
    let conversationCreated = false;

    const sendToTelnyx = (ws: WSContext, base64Audio: string) => {
      // Telnyx media frame: event + media.payload only, no stream id.
      ws.send(
        JSON.stringify({ event: "media", media: { payload: base64Audio } }),
      );
    };

    return {
      async onOpen(_, ws) {
        try {
          phonicSocket = await phonicClient.conversations.connect();

          phonicSocket.on("message", (message) => {
            switch (message.type) {
              case "audio_chunk":
                // Only send once Telnyx's "start" has set streamId. Don't gate
                // conversation_created on it — that message can arrive first.
                if (streamId) {
                  sendToTelnyx(ws, message.audio);
                }
                break;

              case "conversation_created":
                conversationCreated = true;
                break;

              case "error":
                console.error("Phonic error:", message.error);
                break;
            }
          });

          phonicSocket.on("close", (event) => {
            console.log(
              `Phonic WebSocket closed with code ${event.code} and reason "${event.reason}"`,
            );
          });

          phonicSocket.on("error", (error) => {
            console.error(`Error from Phonic WebSocket: ${error.message}`);
          });

          // connect() resolves before the socket is open, so send the config on
          // the open event (or right away if it is already open).
          const sendInitialConfig = () => {
            phonicSocket?.sendConfig({
              type: "config",
              agent: "agent-telnyx",
              input_format: "mulaw_8000",
              output_format: "mulaw_8000",
            } as Phonic.ConfigPayload);
          };

          const WS_OPEN = 1;
          if (phonicSocket.readyState === WS_OPEN) {
            sendInitialConfig();
          } else {
            phonicSocket.on("open", sendInitialConfig);
          }
        } catch (error) {
          console.error("Failed to connect to Phonic:", error);
          ws.close();
        }
      },

      async onMessage(event, ws) {
        const message = event.data;
        if (typeof message !== "string") return;

        try {
          const data = JSON.parse(message) as TelnyxWebSocketMessage;

          switch (data.event) {
            case "start":
              streamId = data.stream_id;
              break;

            case "media":
              // A bidirectional stream forks only the caller's audio, so
              // forward every frame (don't filter on media.track).
              if (phonicSocket && conversationCreated) {
                await phonicSocket.sendAudioChunk({
                  type: "audio_chunk",
                  audio: data.media.payload,
                });
              }
              break;

            case "error":
              console.error(
                `Telnyx stream error ${data.code}: ${data.title}`,
                data.detail ?? "",
              );
              break;

            case "stop":
              ws.close();
              break;
          }
        } catch (error) {
          console.error("Failed to parse Telnyx message:", error);
        }
      },

      onClose() {
        console.log("Telnyx WebSocket closed");
        if (phonicSocket) {
          phonicSocket.close();
        }
      },

      onError(event) {
        console.error("WebSocket error:", event);
      },
    };
  }),
);

const server = serve({
  fetch: app.fetch,
  port,
});

injectWebSocket(server);

console.log(`Server listening on port ${port}`);

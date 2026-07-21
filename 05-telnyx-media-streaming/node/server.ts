import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { type Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import { type Phonic, PhonicClient } from "phonic";
import { phonicApiKey } from "./env-vars";
import type { TelnyxWebSocketMessage } from "./types";

const app = new Hono();
const phonicClient = new PhonicClient({
  apiKey: phonicApiKey,
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// TeXML returned for inbound calls. The important part is bidirectionalMode:
// without it Telnyx streams caller audio to us but IGNORES anything we send
// back, so the agent is heard by nobody. bidirectionalCodec must match the
// agent's audio_format (PCMU 8 kHz == mulaw_8000).
// Registered for both GET and POST so it works regardless of the "Voice
// Method" you pick when configuring the TeXML application in the portal.
const inboundHandler = (c: Context) => {
  const url = new URL(c.req.url);
  const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${url.host}/ws" track="inbound_track" bidirectionalMode="rtp" bidirectionalCodec="PCMU" />
  </Connect>
</Response>`;

  return c.text(texml, 200, { "Content-Type": "application/xml" });
};

app.get("/inbound", inboundHandler);
app.post("/inbound", inboundHandler);

app.get(
  "/ws",
  upgradeWebSocket(() => {
    let phonicSocket: Awaited<
      ReturnType<typeof phonicClient.conversations.connect>
    > | null = null;
    let streamId: string | null = null;
    let conversationCreated = false;

    // Frame counters so you can confirm audio flows BOTH ways. Watch the log:
    // fromTelnyx should climb while the caller speaks, and toTelnyx should
    // climb while the agent speaks. If toTelnyx climbs but the caller hears
    // nothing, bidirectionalMode is not set on the Telnyx side.
    let framesFromTelnyx = 0;
    let framesToTelnyx = 0;
    const statsTimer = setInterval(() => {
      console.log(
        `[audio] Telnyx->Phonic: ${framesFromTelnyx} frames | Phonic->Telnyx: ${framesToTelnyx} frames`,
      );
    }, 2000);

    const sendToTelnyx = (ws: WSContext, base64Audio: string) => {
      // Telnyx bidirectional media frame. Unlike Twilio, do NOT include a
      // stream id here — just event + media.payload (base64 PCMU).
      ws.send(
        JSON.stringify({
          event: "media",
          media: {
            payload: base64Audio,
          },
        }),
      );
      framesToTelnyx += 1;
    };

    return {
      async onOpen(_, ws) {
        try {
          phonicSocket = await phonicClient.conversations.connect();

          phonicSocket.on("message", (message) => {
            if (!streamId) return;

            switch (message.type) {
              case "audio_chunk":
                sendToTelnyx(ws, message.audio);
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

          // connect() resolves before the socket has finished opening, so
          // sending immediately throws "Socket is not open". Send the config
          // once the socket is open (or right away if it already is).
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
              console.log(`Telnyx stream started: ${streamId}`);
              break;

            case "media":
              // Telnyx labels the caller track "inbound_track" (Twilio uses
              // "inbound"). The <Stream track="inbound_track"> above already
              // limits us to the caller's audio, so forward every media frame.
              if (phonicSocket && conversationCreated) {
                if (framesFromTelnyx === 0) {
                  console.log(
                    `First inbound media frame (track="${data.media.track}")`,
                  );
                }
                framesFromTelnyx += 1;
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
        clearInterval(statsTimer);
        console.log(
          `Telnyx WebSocket closed. Final counts -> Telnyx->Phonic: ${framesFromTelnyx}, Phonic->Telnyx: ${framesToTelnyx}`,
        );
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

const port = 3000;
const server = serve({
  fetch: app.fetch,
  port,
});

injectWebSocket(server);

console.log(`Server listening on port ${port}`);

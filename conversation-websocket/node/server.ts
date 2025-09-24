import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { type Phonic, PhonicClient } from "phonic";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { phonicApiKey } from "./env-vars";
import type { TwilioWebSocketMessage } from "./types";

const app = new Hono();
const phonicClient = new PhonicClient({
  apiKey: phonicApiKey,
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.post("/inbound", (c) => {
  const url = new URL(c.req.url);
  const response = new VoiceResponse();
  response.connect().stream({
    url: `wss://${url.host}/ws`,
  });

  return c.text(response.toString(), 200, { "Content-Type": "text/xml" });
});

app.get(
  "/ws",
  upgradeWebSocket(() => {
    let phonicSocket: Awaited<
      ReturnType<typeof phonicClient.conversations.connect>
    > | null = null;
    let streamSid: string | null = null;

    const sendToTwilio = (ws: WSContext, data: unknown) => {
      ws.send(JSON.stringify(data));
    };

    return {
      async onOpen(_, ws) {
        try {
          phonicSocket = await phonicClient.conversations.connect();

          phonicSocket.on("message", (message) => {
            if (!streamSid) return;

            switch (message.type) {
              case "audio_chunk":
                sendToTwilio(ws, {
                  event: "media",
                  streamSid: streamSid,
                  media: {
                    payload: message.audio,
                  },
                });
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

          await phonicSocket.sendConfig({
            type: "config",
            agent: "agent-websocket",
            input_format: "mulaw_8000",
            output_format: "mulaw_8000",
          } as Phonic.ConfigPayload);
        } catch (error) {
          console.error("Failed to connect to Phonic:", error);
          ws.close();
        }
      },

      async onMessage(event, ws) {
        const message = event.data;
        if (typeof message !== "string") return;

        try {
          const data = JSON.parse(message) as TwilioWebSocketMessage;

          switch (data.event) {
            case "start":
              streamSid = data.streamSid;
              break;

            case "media":
              if (phonicSocket && data.media.track === "inbound") {
                await phonicSocket.sendAudioChunk({
                  type: "audio_chunk",
                  audio: data.media.payload,
                });
              }
              break;

            case "stop":
              ws.close();
              break;
          }
        } catch (error) {
          console.error("Failed to parse Twilio message:", error);
        }
      },

      onClose() {
        console.log("Twilio WebSocket closed");
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

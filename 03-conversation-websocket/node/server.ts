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
  // Resume the same conversation if the connection to Phonic drops mid-call.
  reconnectConversationOnAbnormalDisconnect: true,
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
    let conversationCreated = false;
    let closed = false;

    const sendToTwilio = (ws: WSContext, data: unknown) => {
      ws.send(JSON.stringify(data));
    };

    const startPhonic = async (ws: WSContext) => {
      try {
        phonicSocket = await phonicClient.conversations.connect();
        if (closed) {
          phonicSocket.close();
          return;
        }

        phonicSocket.on("message", (message) => {
          if (closed || !streamSid) return;

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

        // connect() resolves before the socket is open, and sending earlier throws.
        await phonicSocket.waitForOpen();
        if (closed) return;
        phonicSocket.sendConfig({
          type: "config",
          agent: "agent-websocket",
          input_format: "mulaw_8000",
          output_format: "mulaw_8000",
        } as Phonic.ConfigPayload);
      } catch (error) {
        console.error("Failed to connect to Phonic:", error);
        closed = true;
        phonicSocket?.close();
        ws.close();
      }
    };

    return {
      async onMessage(event, ws) {
        const message = event.data;
        if (closed || typeof message !== "string") return;

        try {
          const data = JSON.parse(message) as TwilioWebSocketMessage;

          switch (data.event) {
            case "start":
              // Start Phonic only once Twilio can receive the greeting.
              if (streamSid) return;
              streamSid = data.streamSid;
              await startPhonic(ws);
              break;

            case "media":
              if (
                phonicSocket &&
                conversationCreated &&
                data.media.track === "inbound"
              ) {
                await phonicSocket.sendAudioChunk({
                  type: "audio_chunk",
                  audio: data.media.payload,
                });
              }
              break;

            case "stop":
              closed = true;
              phonicSocket?.close();
              ws.close();
              break;
          }
        } catch (error) {
          console.error("Failed to parse Twilio message:", error);
        }
      },

      onClose() {
        closed = true;
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

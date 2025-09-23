import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { type Phonic, PhonicClient } from "phonic";
import twilio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { phonicApiKey, twilioAccountSid, twilioAuthToken } from "./env-vars";
import type { TwilioWebSocketMessage } from "./types";

const app = new Hono();
const phonicClient = new PhonicClient({
  apiKey: phonicApiKey,
});
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

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
    let callSid: string | null = null;
    let userFinishedSpeakingTimestamp = performance.now();
    let isFirstAudioChunk = true;

    const sendToTwilio = (ws: any, data: any) => {
      ws.send(JSON.stringify(data));
    };

    const handleToolCall = async ({
      toolCallId,
      toolName,
      parameters,
    }: {
      toolCallId: string;
      toolName: string;
      parameters: Record<string, unknown>;
    }) => {
      console.log(
        "Tool call:",
        JSON.stringify({ toolCallId, toolName, parameters }, null, 2),
      );

      switch (toolName) {
        case "current_time": {
          phonicSocket?.sendToolCallOutput({
            type: "tool_call_output",
            tool_call_id: toolCallId,
            output: "4:15 PM",
          });
          break;
        }

        case "current_temperature": {
          await new Promise((resolve) => setTimeout(resolve, 3000));

          phonicSocket?.sendToolCallOutput({
            type: "tool_call_output",
            tool_call_id: toolCallId,
            output: {
              temperature: "75 degrees Fahrenheit",
            },
          });

          break;
        }
      }
    };

    return {
      async onOpen(_, ws) {
        try {
          phonicSocket = await phonicClient.conversations.connect();

          phonicSocket.on("message", (message) => {
            if (!streamSid) return;

            switch (message.type) {
              case "input_text":
                console.log(`\n\nUser: ${message.text}`);
                isFirstAudioChunk = true;
                break;

              case "user_started_speaking":
                console.log("User started speaking");
                break;

              case "user_finished_speaking":
                userFinishedSpeakingTimestamp = performance.now();
                break;

              case "tool_call":
                handleToolCall({
                  toolCallId: message.tool_call_id,
                  toolName: message.tool_name,
                  parameters: message.parameters,
                });
                break;

              case "audio_chunk":
                if (isFirstAudioChunk) {
                  console.log(
                    "\nTTFB:",
                    Math.round(
                      performance.now() - userFinishedSpeakingTimestamp,
                    ),
                    "ms",
                  );
                  process.stdout.write("Assistant: ");
                  isFirstAudioChunk = false;
                }

                if (message.text !== "") {
                  process.stdout.write(message.text);
                }

                sendToTwilio(ws, {
                  event: "media",
                  streamSid: streamSid,
                  media: {
                    payload: message.audio,
                  },
                });
                break;

              case "assistant_ended_conversation":
                sendToTwilio(ws, {
                  event: "mark",
                  streamSid: streamSid,
                  mark: {
                    name: "end_conversation_mark",
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
            agent: "agent-websocket-tools",
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
              callSid = data.start.callSid;
              if (phonicSocket && callSid) {
                await phonicSocket.sendSetExternalId({
                  type: "set_external_id",
                  external_id: callSid,
                });
              }
              break;

            case "media":
              if (phonicSocket && data.media.track === "inbound") {
                await phonicSocket.sendAudioChunk({
                  type: "audio_chunk",
                  audio: data.media.payload,
                });
              }
              break;

            case "mark":
              if (data.mark.name === "end_conversation_mark" && callSid) {
                twilioClient
                  .calls(callSid)
                  .update({ status: "completed" })
                  .then((call) =>
                    console.log(`Ended call for ${JSON.stringify(call)}`),
                  )
                  .catch((err) => {
                    console.error("Error ending call:", err);
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

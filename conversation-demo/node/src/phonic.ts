import type { Context } from "hono";
import type { WSContext } from "hono/ws";
import { type Phonic, PhonicClient } from "phonic";
import { phonicApiBaseUrl, phonicApiKey } from "./phonic-env-vars";

const phonic = new PhonicClient({
  baseUrl: phonicApiBaseUrl,
  apiKey: phonicApiKey,
});

export const setupPhonic = (
  ws: WSContext,
  c: Context,
  config: Phonic.ConfigPayload,
) => {
  let phonicWebSocket: Awaited<ReturnType<typeof phonic.conversations.connect>> | null =
    null;

  let userFinishedSpeakingTimestamp = performance.now();
  let isFirstAudioChunk = true;

  phonic.conversations
    .connect()
    .then((socket) => {
      phonicWebSocket = socket;

      socket.sendConfig(config);

      socket.on("message", (message) => {
        switch (message.type) {
          case "input_text": {
            console.log(`\n\nUser: ${message.text}`);

            isFirstAudioChunk = true;

            break;
          }

          case "user_started_speaking": {
            console.log("User started speaking");
            break;
          }

          case "user_finished_speaking": {
            userFinishedSpeakingTimestamp = performance.now();
            break;
          }

          case "tool_call": {
            console.log("Tool call function name:", message.tool_name);
            console.log("Tool call request body:", message.parameters);

            break;
          }

          case "audio_chunk": {
            if (isFirstAudioChunk) {
              console.log(
                "\nTTFB:",
                Math.round(performance.now() - userFinishedSpeakingTimestamp),
                "ms",
              );
              process.stdout.write("Assistant: ");
              isFirstAudioChunk = false;
            }

            if (message.text !== "") {
              process.stdout.write(message.text);
            }

            ws.send(
              JSON.stringify({
                event: "media",
                streamSid: c.get("streamSid"),
                media: {
                  payload: message.audio,
                },
              }),
            );
            break;
          }

          case "interrupted_response": {
            ws.send(
              JSON.stringify({
                event: "clear",
                streamSid: c.get("streamSid"),
              }),
            );
            break;
          }

          case "error": {
            console.error("Phonic error:", message.error);
            break;
          }

          case "assistant_ended_conversation": {
            ws.send(
              JSON.stringify({
                event: "mark",
                streamSid: c.get("streamSid"),
                mark: {
                  name: "end_conversation_mark",
                },
              }),
            );
            break;
          }
        }
      });

      socket.on("close", (event) => {
        console.log(
          `Phonic WebSocket closed with code ${event.code} and reason "${event.reason}"`,
        );
      });

      socket.on("error", (error) => {
        console.log(`Error from Phonic WebSocket: ${error.message}`);
      });
    })
    .catch((error) => {
      console.error("Failed to connect to Phonic:", error);
    });

  return {
    audioChunk: (audio: string) =>
      phonicWebSocket?.sendAudioChunk({ type: "audio_chunk", audio }),
    setExternalId: (externalId: string) =>
      phonicWebSocket?.sendSetExternalId({
        type: "set_external_id",
        external_id: externalId,
      }),
    sendToolCallOutput: (toolCallId: string, output: unknown) =>
      phonicWebSocket?.sendToolCallOutput({
        type: "tool_call_output",
        tool_call_id: toolCallId,
        output,
      }),
    updateSystemPrompt: (systemPrompt: string) =>
      phonicWebSocket?.sendUpdateSystemPrompt({
        type: "update_system_prompt",
        system_prompt: systemPrompt,
      }),
    close: () => phonicWebSocket?.close(),
  };
};

import { type Phonic, PhonicClient } from "phonic";
import { phonicApiKey } from "./env-vars";

const phonic = new PhonicClient({
  apiKey: phonicApiKey,
});

export const setupPhonic = ({
  getStreamSid,
  sendMessageToTwilio,
  config,
}: {
  getStreamSid: () => string;
  sendMessageToTwilio: (obj: unknown) => void;
  config: Phonic.ConfigPayload;
}) => {
  let phonicWebSocket: Awaited<
    ReturnType<typeof phonic.conversations.connect>
  > | null = null;

  let userFinishedSpeakingTimestamp = performance.now();
  let isFirstAudioChunk = true;

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
        phonicWebSocket?.sendToolCallOutput({
          type: "tool_call_output",
          tool_call_id: toolCallId,
          output: "4:15 PM",
        });
        break;
      }

      case "current_temperature": {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        phonicWebSocket?.sendToolCallOutput({
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

  phonic.conversations
    .connect()
    .then((socket) => {
      phonicWebSocket = socket;

      socket.sendConfig(config);

      socket.on("message", (message) => {
        switch (message.type) {
          case "input_text": {
            if (message.type === "input_text") {
              console.log(`\n\nUser: ${message.text}`);

              isFirstAudioChunk = true;
            }

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
            if (message.type === "tool_call") {
              handleToolCall({
                toolCallId: message.tool_call_id,
                toolName: message.tool_name,
                parameters: message.parameters,
              });
            }
            break;
          }

          case "audio_chunk": {
            if (message.type === "audio_chunk") {
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

              sendMessageToTwilio({
                event: "media",
                streamSid: getStreamSid(),
                media: {
                  payload: message.audio,
                },
              });
            }
            break;
          }

          case "error": {
            if (message.type === "error") {
              console.error("Phonic error:", message.error);
            }
            break;
          }

          case "assistant_ended_conversation": {
            sendMessageToTwilio({
              event: "mark",
              streamSid: getStreamSid(),
              mark: {
                name: "end_conversation_mark",
              },
            });
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
    close: () => phonicWebSocket?.close(),
  };
};

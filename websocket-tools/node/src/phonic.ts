import { Phonic, type PhonicSTSConfig } from "phonic";
import { phonicApiBaseUrl, phonicApiKey } from "./env-vars";

const phonic = new Phonic(phonicApiKey, {
  baseUrl: phonicApiBaseUrl || "https://api.phonic.co",
});

export const setupPhonic = ({
  getStreamSid,
  sendMessageToTwilio,
  config,
}: {
  getStreamSid: () => string;
  sendMessageToTwilio: (obj: unknown) => void;
  config: PhonicSTSConfig;
}) => {
  const phonicWebSocket = phonic.sts.websocket(config);
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
        phonicWebSocket.sendToolCallOutput({
          toolCallId,
          output: "4:15 PM", // output can be a simple string
        });
        break;
      }

      case "current_temperature": {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        phonicWebSocket.sendToolCallOutput({
          toolCallId,
          output: {
            // output can be any object
            temperature: "75 degrees Fahrenheit",
          },
        });

        break;
      }
    }
  };

  phonicWebSocket.onMessage((message) => {
    switch (message.type) {
      case "input_text": {
        if (message.text !== "") {
          console.log(`\n\nUser: ${message.text}`);

          isFirstAudioChunk = true;
        }

        break;
      }

      case "user_finished_speaking": {
        userFinishedSpeakingTimestamp = performance.now();

        break;
      }

      case "tool_call": {
        handleToolCall({
          toolCallId: message.tool_call_id,
          toolName: message.tool_name,
          parameters: message.parameters,
        });

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

        sendMessageToTwilio({
          event: "media",
          streamSid: getStreamSid(),
          media: {
            payload: message.audio,
          },
        });
        break;
      }

      case "interrupted_response": {
        sendMessageToTwilio({
          event: "clear",
          streamSid: getStreamSid(),
        });
        break;
      }

      case "error": {
        console.error("Phonic error:", message.error);
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

  phonicWebSocket.onClose((event) => {
    console.log(
      `Phonic WebSocket closed with code ${event.code} and reason "${event.reason}"`,
    );
  });

  phonicWebSocket.onError((event) => {
    console.log(`Error from Phonic WebSocket: ${event.message}`);
  });

  return {
    audioChunk: (audio: string) => {
      phonicWebSocket.audioChunk({ audio });
    },
    setExternalId: (externalId: string) => {
      phonicWebSocket.setExternalId({ externalId });
    },
    close: phonicWebSocket.close,
  };
};

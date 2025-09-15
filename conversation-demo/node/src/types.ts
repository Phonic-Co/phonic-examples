export type WebSocketData = {
  streamSid: string | null;
  speaking: boolean;
  transcribe: (audioinBase64: string) => void;
  promptLLM: (prompt: string) => Promise<void>;
  phonic: {
    generate(text: string): void;
    flush(): void;
    stop(): void;
    close(): void;
  };
};

export type TwilioWebSocketMessage =
  | {
      event: "start";
      start: {
        callSid: string;
      };
      streamSid: string;
    }
  | {
      event: "media";
      media: {
        track: "inbound" | "outbound";
        payload: string;
      };
    }
  | {
      event: "stop";
    }
  | {
      event: "mark";
      mark: {
        name: string;
      };
    };

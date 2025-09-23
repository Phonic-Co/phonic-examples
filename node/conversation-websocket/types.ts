export type TwilioWebSocketMessage =
  | {
      event: "start";
      streamSid: string;
      start: {
        callSid: string;
        customParameters?: Record<string, any>;
      };
    }
  | {
      event: "media";
      streamSid: string;
      media: {
        track: "inbound" | "outbound";
        chunk: string;
        timestamp: string;
        payload: string;
      };
    }
  | {
      event: "stop";
      streamSid: string;
    }
  | {
      event: "mark";
      streamSid: string;
      mark: {
        name: string;
      };
    };

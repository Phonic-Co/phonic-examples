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
        track: "inbound";
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

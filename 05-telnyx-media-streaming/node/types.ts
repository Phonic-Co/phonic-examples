// Messages Telnyx sends over the media-streaming WebSocket.
// Note the field names differ from Twilio: Telnyx uses `stream_id`
// (snake_case), not `streamSid`.
export type TelnyxWebSocketMessage =
  | {
      event: "connected";
      version: string;
    }
  | {
      event: "start";
      sequence_number: string;
      stream_id: string;
      start: {
        call_control_id: string;
        media_format: {
          encoding: string;
          sample_rate: number;
          channels: number;
        };
      };
    }
  | {
      event: "media";
      sequence_number: string;
      stream_id: string;
      media: {
        track: "inbound_track" | "outbound_track";
        chunk: string;
        timestamp: string;
        payload: string;
      };
    }
  | {
      event: "dtmf";
      stream_id: string;
      dtmf: {
        digit: string;
      };
    }
  | {
      event: "stop";
      sequence_number: string;
      stream_id: string;
      stop: {
        call_control_id: string;
      };
    }
  | {
      event: "error";
      stream_id?: string;
      code: number;
      title: string;
      detail?: string;
    };

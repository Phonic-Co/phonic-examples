import { config } from "dotenv";
import WebSocket from "ws";

config({ path: ".env.local" });

const apiKey = process.env.PHONIC_API_KEY;
const conversationId = process.env.CONVERSATION_ID;
const apiUrl = process.env.PHONIC_API_URL ?? "https://api.phonic.ai";

if (!apiKey) throw new Error("Missing PHONIC_API_KEY");
if (!conversationId) throw new Error("Missing CONVERSATION_ID");

const websocketUrl = new URL(
  `/v1/conversations/${encodeURIComponent(conversationId)}/live/ws`,
  apiUrl,
);
websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:";

const authorization = `Bearer ${apiKey}`;
const socket = new WebSocket(websocketUrl, {
  headers: { Authorization: authorization },
});
let playlistTimer: ReturnType<typeof setInterval> | undefined;
let playlistRequestInFlight = false;

const inspectPlaylist = async (playlistUrl: string) => {
  if (playlistRequestInFlight) return;
  playlistRequestInFlight = true;

  try {
    const response = await fetch(playlistUrl, {
      headers: { Authorization: authorization },
    });
    const playlist = await response.text();

    if (!response.ok) {
      throw new Error(
        `Playlist request failed (${response.status}): ${playlist}`,
      );
    }

    const segmentUrls = playlist
      .split("\n")
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => new URL(line, playlistUrl).toString());
    const latestSegmentUrl = segmentUrls.at(-1);

    console.log("Published segments:", segmentUrls.length);

    if (latestSegmentUrl) {
      const segmentResponse = await fetch(latestSegmentUrl, {
        headers: { Authorization: authorization },
      });
      const segment = await segmentResponse.arrayBuffer();
      console.log(
        `Latest segment: ${segmentResponse.status} ${segment.byteLength} bytes`,
      );
    }
  } finally {
    playlistRequestInFlight = false;
  }
};

socket.on("message", async (rawMessage) => {
  const message = JSON.parse(rawMessage.toString()) as {
    type: string;
    url?: string;
    conversation?: { live_transcript?: string };
  };

  switch (message.type) {
    case "conversation-audio": {
      if (!message.url) {
        throw new Error("conversation-audio message is missing its URL");
      }

      clearInterval(playlistTimer);
      const playlistUrl = message.url;
      console.log("Live playlist:", playlistUrl);
      await inspectPlaylist(playlistUrl);
      playlistTimer = setInterval(() => {
        inspectPlaylist(playlistUrl).catch(console.error);
      }, 2_000);
      break;
    }
    case "conversation-updated":
      console.log("Transcript:", message.conversation?.live_transcript ?? "");
      break;
    default:
      console.log("Live event:", message.type);
  }
});

socket.on("close", (code, reason) => {
  clearInterval(playlistTimer);
  console.log(`Live preview closed (${code}): ${reason.toString()}`);
});

socket.on("error", (error) => {
  console.error("Live preview failed:", error);
});

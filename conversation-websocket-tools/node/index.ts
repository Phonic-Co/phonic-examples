import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import twilio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { twilioAccountSid, twilioAuthToken } from "./env-vars";
import { setupPhonic } from "./phonic";
import type { TwilioWebSocketMessage } from "./types";

const app = new Hono();
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/", (c) => {
  return c.json({
    example: "phonic-examples-websocket-tools",
  });
});

app.post("/inbound", (c) => {
  const url = new URL(c.req.url);
  const response = new VoiceResponse();

  response.connect().stream({
    url: `wss://${url.host}/inbound-ws`,
  });

  return c.text(response.toString(), 200, { "Content-Type": "text/xml" });
});

app.get(
  "/inbound-ws",
  upgradeWebSocket(() => {
    let phonic: ReturnType<typeof setupPhonic>;
    let streamSid = "";
    let callSid = "";

    return {
      onOpen(_, ws) {
        phonic = setupPhonic({
          getStreamSid: () => streamSid,
          sendMessageToTwilio: (obj: unknown) => ws.send(JSON.stringify(obj)),
          config: {
            type: "config",
            agent: "websocket-tools",
            input_format: "mulaw_8000",
            output_format: "mulaw_8000",
          },
        });
      },
      onMessage(event, ws) {
        const message = event.data;

        if (typeof message !== "string") {
          return;
        }

        try {
          const messageObj = JSON.parse(message) as TwilioWebSocketMessage;

          if (messageObj.event === "start") {
            streamSid = messageObj.streamSid;
            callSid = messageObj.start.callSid;

            phonic.setExternalId(callSid);
          } else if (messageObj.event === "stop") {
            ws.close();
          } else if (
            messageObj.event === "media" &&
            messageObj.media.track === "inbound"
          ) {
            phonic.audioChunk(messageObj.media.payload);
          } else if (
            messageObj.event === "mark" &&
            messageObj.mark.name === "end_conversation_mark"
          ) {
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
        } catch (error) {
          console.error("Failed to parse Twilio message:", error);
        }
      },
      onClose() {
        console.log("\n\nTwilio call finished");

        phonic.close();
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

console.log(`Listening on port ${port}`);

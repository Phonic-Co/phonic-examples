import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { Phonic } from "phonic";
import { Webhook } from "svix";
import twilio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import { twilioAccountSid, twilioAuthToken } from "./call-env-vars";
import { setupPhonic } from "./phonic";
import type { TwilioWebSocketMessage } from "./types";
import {
  phonicConfigWebhookAuthorization,
  phonicWebhookSecret,
} from "./webhook-env-vars";

const app = new Hono();
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

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
  upgradeWebSocket((c) => {
    let phonic: ReturnType<typeof setupPhonic>;

    return {
      onOpen(_event, ws) {
        c.set("streamSid", null);

        phonic = setupPhonic(ws, c, {
          project: "main",
          input_format: "mulaw_8000",
          system_prompt: "You are a helpful assistant.",
          welcome_message: "Hello, how can I help you today?",
          voice_id: "grant",
          output_format: "mulaw_8000",
          type: "config",
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
            c.set("streamSid", messageObj.streamSid);
            c.set("callSid", messageObj.start.callSid);

            phonic.setExternalId(messageObj.start.callSid);
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
              .calls(c.get("callSid"))
              .update({ status: "completed" })
              .then((call) =>
                console.log(`Ended call for ${JSON.stringify(call)}`),
              )
              .catch((err) => {
                console.log("Error ending call:", err);
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

app.post("/outbound", (c) => {
  const url = new URL(c.req.url);
  const response = new VoiceResponse();

  response.connect().stream({
    url: `wss://${url.host}/outbound-ws`,
  });

  return c.text(response.toString(), 200, { "Content-Type": "text/xml" });
});

app.get(
  "/outbound-ws",
  upgradeWebSocket((c) => {
    let phonic: ReturnType<typeof setupPhonic>;

    return {
      onOpen(_event, ws) {
        c.set("streamSid", null);

        phonic = setupPhonic(ws, c, {
          project: "main",
          input_format: "mulaw_8000",
          system_prompt: "You are a helpful assistant.",
          welcome_message: "Hello, how can I help you today?",
          voice_id: "grant",
          output_format: "mulaw_8000",
          type: "config",
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
            c.set("streamSid", messageObj.streamSid);
            c.set("callSid", messageObj.start.callSid);

            phonic.setExternalId(messageObj.start.callSid);
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
              .calls(c.get("callSid"))
              .update({ status: "completed" })
              .then((call) =>
                console.log(`Ended call for ${JSON.stringify(call)}`),
              )
              .catch((err) => {
                console.log("Error ending call:", err);
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

app.post("/webhooks/phonic", async (c) => {
  if (!phonicWebhookSecret) {
    return c.text("Bad Request", 400);
  }

  const rawBody = await c.req.text();
  const wh = new Webhook(phonicWebhookSecret);

  try {
    const payload = wh.verify(rawBody, {
      "svix-id": c.req.header("svix-id") ?? "",
      "svix-timestamp": c.req.header("svix-timestamp") ?? "",
      "svix-signature": c.req.header("svix-signature") ?? "",
    });

    console.log(payload);

    return c.text("OK", 200);
  } catch (error) {
    console.error("Failed to verify webhook:", error);

    return c.text("Bad Request", 400);
  }
});

app.post("/webhooks/phonic-config", async (c) => {
  if (c.req.header("Authorization") !== phonicConfigWebhookAuthorization) {
    return c.text("Bad Request", 400);
  }

  const body =
    (await c.req.json()) as Phonic.PhonicConfigurationEndpointRequestPayload;
  const response: Phonic.PhonicConfigurationEndpointResponsePayload = {
    welcome_message: "Hey {{customer_name}}, how can I help you today?",
    system_prompt: `
      ${body.agent.system_prompt}
      Last time customer called about {{subject}} was on 17th of April 2024.
    `.trim(),
    template_variables: {
      customer_name: "Alice",
      subject: "tennis",
    },
  };

  return c.json(response);
});

app.post("/webhooks/phonic-tools/next-appointment", async (c) => {
  if (c.req.header("Authorization") !== phonicConfigWebhookAuthorization) {
    return c.text("Bad Request", 400);
  }

  const body = await c.req.json();

  console.log(body);

  // Do something with the `body` here to construct the response

  return c.json({
    next_appointment: {
      date: "2026-04-17",
      location: "123 Main St, Anytown, USA",
    },
  });
});

const port = 3000;
const server = serve({
  fetch: app.fetch,
  port,
});

injectWebSocket(server);

console.log(`Listening on port ${port}`);

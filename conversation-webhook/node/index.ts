import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { Hono } from "hono";
import type { Phonic } from "phonic";
import { Webhook } from "svix";

config({ path: ".env.local" });

const configWebhookAuthorization =
  process.env.PHONIC_CONFIG_WEBHOOK_AUTHORIZATION ?? "Bearer authorization_key";
const phonicWebhookSecret = process.env.PHONIC_WEBHOOK_SECRET;

const app = new Hono();

app.post("/webhooks/phonic-config", async (c) => {
  if (c.req.header("Authorization") !== configWebhookAuthorization) {
    return c.text("Bad Request", 400);
  }

  const body =
    (await c.req.json()) as Phonic.PhonicConfigurationEndpointRequestPayload;
  const response: Phonic.PhonicConfigurationEndpointResponsePayload = {
    welcome_message: "Hey {{customer_name}}, how can I help you today?",
    system_prompt: `
        ${body.agent.system_prompt}
        The customer is visiting 1 week from now.
      `.trim(),
    template_variables: {
      customer_name: "Alice",
      interest: "nature",
    },
  };

  return c.json(response);
});

app.post("/webhooks/events", async (c) => {
  if (!phonicWebhookSecret) {
    return c.text("Bad Request", 400);
  }

  const rawBody = await c.req.text();

  console.log("Events webhook raw body:", rawBody);
  const wh = new Webhook(phonicWebhookSecret);

  try {
    const payload = wh.verify(rawBody, {
      "svix-id": c.req.header("svix-id") ?? "",
      "svix-timestamp": c.req.header("svix-timestamp") ?? "",
      "svix-signature": c.req.header("svix-signature") ?? "",
    });

    // Do something with the payload
    console.log("Events webhook payload:", payload);

    return c.text("OK", 200);
  } catch (error) {
    console.error("Failed to verify webhook:", error);

    return c.text("Bad Request", 400);
  }
});

app.post("/webhooks/add-destination", async (c) => {
  const destinationName = c.req.query("destination_name");

  // Do something with the destination name
  console.log(
    "add-destination webhook tool called for destination:",
    destinationName,
  );

  return c.json({
    success: true,
    message: `Destination ${destinationName} added to the list of destinations`,
  });
});

const port = 3000;
serve({
  fetch: app.fetch,
  port,
});

console.log(`Listening on port ${port}`);

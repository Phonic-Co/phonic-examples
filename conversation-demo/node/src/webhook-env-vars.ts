import { config } from "dotenv";

config({ path: ".env.local" });

const phonicWebhookSecret = process.env.PHONIC_WEBHOOK_SECRET;
const phonicConfigWebhookAuthorization =
  process.env.PHONIC_CONFIG_WEBHOOK_AUTHORIZATION;

export { phonicConfigWebhookAuthorization, phonicWebhookSecret };

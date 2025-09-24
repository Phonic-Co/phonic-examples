import { config } from "dotenv";

config({ path: ".env.local" });

const phonicApiKey = process.env.PHONIC_API_KEY as string;

if (!phonicApiKey) {
  throw new Error("PHONIC_API_KEY environment variable is not set");
}

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID as string;

if (!twilioAccountSid) {
  throw new Error("TWILIO_ACCOUNT_SID environment variable is not set");
}

const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN as string;

if (!twilioAuthToken) {
  throw new Error("TWILIO_AUTH_TOKEN environment variable is not set");
}

export { phonicApiKey, twilioAccountSid, twilioAuthToken };

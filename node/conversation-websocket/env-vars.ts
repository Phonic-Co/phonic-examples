import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

export const phonicApiKey = process.env.PHONIC_API_KEY as string;
export const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID as string;
export const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN as string;
export const ngrokUrl = process.env.NGROK_URL as string;
export const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER as string;
export const customerPhoneNumber = process.env.CUSTOMER_PHONE_NUMBER as string;

if (!phonicApiKey) {
  throw new Error("Missing PHONIC_API_KEY environment variable");
}

if (!twilioAccountSid) {
  throw new Error("Missing TWILIO_ACCOUNT_SID environment variable");
}

if (!twilioAuthToken) {
  throw new Error("Missing TWILIO_AUTH_TOKEN environment variable");
}

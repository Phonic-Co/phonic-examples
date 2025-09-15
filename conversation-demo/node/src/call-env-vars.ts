import { config } from "dotenv";

config({ path: ".env.local" });

const ngrokUrl = process.env.NGROK_URL as string;

if (!ngrokUrl) {
  throw new Error("NGROK_URL environment variable is not set");
}

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID as string;

if (!twilioAccountSid) {
  throw new Error("TWILIO_ACCOUNT_SID environment variable is not set");
}

const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN as string;

if (!twilioAuthToken) {
  throw new Error("TWILIO_AUTH_TOKEN environment variable is not set");
}

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER as string;

if (!twilioPhoneNumber) {
  throw new Error("TWILIO_PHONE_NUMBER environment variable is not set");
}

const userPhoneNumber = process.env.USER_PHONE_NUMBER as string;

if (!userPhoneNumber) {
  throw new Error("USER_PHONE_NUMBER environment variable is not set");
}

export {
  ngrokUrl,
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  userPhoneNumber,
};

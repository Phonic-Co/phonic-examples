import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export const phonicApiKey = process.env.PHONIC_API_KEY as string;
export const ngrokUrl = process.env.NGROK_URL as string;
export const telnyxApiKey = process.env.TELNYX_API_KEY as string;
export const telnyxConnectionId = process.env.TELNYX_CONNECTION_ID as string;
export const telnyxPhoneNumber = process.env.TELNYX_PHONE_NUMBER as string;
export const customerPhoneNumber = process.env.CUSTOMER_PHONE_NUMBER as string;

if (!phonicApiKey) {
  throw new Error("Missing PHONIC_API_KEY environment variable");
}

if (!ngrokUrl) {
  throw new Error("Missing NGROK_URL environment variable");
}

if (!telnyxApiKey) {
  throw new Error("Missing TELNYX_API_KEY environment variable");
}

// Only required for outbound-call.ts (Call Control dial).
export function requireOutboundEnvVars() {
  if (!telnyxConnectionId) {
    throw new Error("Missing TELNYX_CONNECTION_ID environment variable");
  }

  if (!telnyxPhoneNumber) {
    throw new Error("Missing TELNYX_PHONE_NUMBER environment variable");
  }

  if (!customerPhoneNumber) {
    throw new Error("Missing CUSTOMER_PHONE_NUMBER environment variable");
  }
}

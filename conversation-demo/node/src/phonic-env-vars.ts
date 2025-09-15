import { config } from "dotenv";

config({ path: ".env.local" });

const phonicApiKey = process.env.PHONIC_API_KEY as string;

if (!phonicApiKey) {
  throw new Error("PHONIC_API_KEY environment variable is not set");
}

const phonicApiBaseUrl = process.env.PHONIC_API_BASE_URL;

export { phonicApiBaseUrl, phonicApiKey };

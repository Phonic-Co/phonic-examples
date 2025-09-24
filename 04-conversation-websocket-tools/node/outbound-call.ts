import twilio from "twilio";
import {
  customerPhoneNumber,
  ngrokUrl,
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
} from "./env-vars";

const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

async function makeOutboundCall() {
  await twilioClient.calls.create({
    url: `https://${ngrokUrl.replace("https://", "")}/inbound`,
    to: customerPhoneNumber,
    from: twilioPhoneNumber,
  });
}

makeOutboundCall();

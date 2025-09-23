import twilio from "twilio";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import {
  customerPhoneNumber,
  ngrokUrl,
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
} from "./env-vars";

const client = twilio(twilioAccountSid, twilioAuthToken);

async function makeCall() {
  const response = new VoiceResponse();
  response.connect().stream({
    url: `wss://${ngrokUrl}/ws`,
  });

  try {
    const call = await client.calls.create({
      twiml: response.toString(),
      to: customerPhoneNumber,
      from: twilioPhoneNumber,
    });

    console.log(`Call initiated with SID: ${call.sid}`);
  } catch (error) {
    console.error("Error making call:", error);
  }
}

makeCall();

import twilio from "twilio";
import {
  ngrokUrl,
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  userPhoneNumber,
} from "./call-env-vars";

const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

async function main() {
  try {
    console.log(`Calling ${userPhoneNumber}`);

    const call = await twilioClient.calls.create({
      to: userPhoneNumber,
      from: twilioPhoneNumber,
      url: `${ngrokUrl}/outbound`,
    });

    console.log(`Success! Call SID: ${call.sid}`);
  } catch (error) {
    console.error("Failed to make a call:", error);
  }
}

main();

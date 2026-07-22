import {
  customerPhoneNumber,
  ngrokUrl,
  requireOutboundEnvVars,
  telnyxApiKey,
  telnyxConnectionId,
  telnyxPhoneNumber,
} from "./env-vars";

requireOutboundEnvVars();

// Places an outbound call with the Telnyx Call Control API (Voice API
// application). Streaming is NOT started here: bidirectional return audio has
// to be set up with streaming_start AFTER the call is answered, so we point
// Telnyx's call webhooks at /call-control and server.ts starts the stream on
// the call.answered event.
async function makeCall() {
  const response = await fetch("https://api.telnyx.com/v2/calls", {
    method: "POST",
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: `Bearer ${telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connection_id: telnyxConnectionId,
      to: customerPhoneNumber,
      from: telnyxPhoneNumber,
      // Per-call webhook override, so you don't have to configure the
      // application's webhook URL in the portal.
      webhook_url: `${ngrokUrl}/call-control`,
    }),
  });

  if (!response.ok) {
    console.error(
      `Error making call: ${response.status} ${response.statusText}`,
      await response.text(),
    );
    return;
  }

  const { data } = (await response.json()) as {
    data: { call_control_id: string };
  };
  console.log(`Call initiated with control ID: ${data.call_control_id}`);
}

makeCall();

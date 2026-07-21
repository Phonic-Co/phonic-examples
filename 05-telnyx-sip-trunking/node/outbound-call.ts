import {
  customerPhoneNumber,
  ngrokUrl,
  requireOutboundEnvVars,
  telnyxApiKey,
  telnyxConnectionId,
  telnyxPhoneNumber,
} from "./env-vars";

requireOutboundEnvVars();

// Places an outbound call with the Telnyx Call Control API and starts
// bidirectional media streaming in the same request. This is the Call Control
// equivalent of the TeXML <Stream> in server.ts, and it is what you'd use with
// a SIP-trunk / Voice API connection rather than a TeXML application.
//
// The stream_bidirectional_* fields are the audio-back-to-Telnyx switch. Drop
// them and Telnyx will forward caller audio to Phonic but play nothing the
// agent says.
async function makeCall() {
  const wsUrl = `wss://${ngrokUrl.replace("https://", "")}/ws`;

  const response = await fetch("https://api.telnyx.com/v2/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connection_id: telnyxConnectionId,
      to: customerPhoneNumber,
      from: telnyxPhoneNumber,
      stream_url: wsUrl,
      stream_track: "inbound_track",
      stream_bidirectional_mode: "rtp",
      stream_bidirectional_codec: "PCMU",
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

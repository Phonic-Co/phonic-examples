import os

import httpx
from dotenv import load_dotenv

load_dotenv(".env.local")


def make_call():
    # Places an outbound call with the Telnyx Call Control API (Voice API
    # application). Streaming is NOT started here: bidirectional return audio
    # must be set up with streaming_start AFTER the call is answered, so we
    # point Telnyx's call webhooks at /call-control and server.py starts the
    # stream on the call.answered event.
    response = httpx.post(
        "https://api.telnyx.com/v2/calls",
        headers={"Authorization": f"Bearer {os.environ['TELNYX_API_KEY']}"},
        json={
            "connection_id": os.environ["TELNYX_CONNECTION_ID"],
            "to": os.environ["CUSTOMER_PHONE_NUMBER"],
            "from": os.environ["TELNYX_PHONE_NUMBER"],
            # Per-call webhook override, so you don't have to configure the
            # application's webhook URL in the portal.
            "webhook_url": f"{os.environ['NGROK_URL']}/call-control",
        },
    )

    if response.status_code >= 400:
        print(f"Error making call: {response.status_code} {response.text}")
        return

    call_control_id = response.json()["data"]["call_control_id"]
    print(f"Call initiated with control ID: {call_control_id}")


if __name__ == "__main__":
    make_call()

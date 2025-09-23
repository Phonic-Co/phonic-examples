import os

from constants import CUSTOMER_PHONE_NUMBER, NGROK_URL, TWILIO_PHONE_NUMBER
from twilio.rest import Client
from twilio.twiml.voice_response import Connect, VoiceResponse

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
client = Client(account_sid, auth_token)


def make_call():
    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=f"wss://{NGROK_URL}/ws")
    response.append(connect)

    client.calls.create(
        twiml=str(response),
        to=CUSTOMER_PHONE_NUMBER,
        from_=TWILIO_PHONE_NUMBER,
    )


if __name__ == "__main__":
    make_call()

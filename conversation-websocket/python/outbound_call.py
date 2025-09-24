import os
from pathlib import Path

from dotenv import load_dotenv
from twilio.rest import Client
from twilio.twiml.voice_response import Connect, VoiceResponse

load_dotenv(".env.local")

client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])


def make_call():
    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=f"wss://{os.environ['NGROK_URL']}/ws")
    response.append(connect)

    client.calls.create(
        twiml=str(response),
        to=os.environ["CUSTOMER_PHONE_NUMBER"],
        from_=os.environ["TWILIO_PHONE_NUMBER"],
    )


if __name__ == "__main__":
    make_call()

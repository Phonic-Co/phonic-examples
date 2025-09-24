from phonic import Phonic
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

client = Phonic(
    api_key=os.getenv("PHONIC_API_KEY"),
)

client.tools.create(
    name="find_flights_sync",
    description="Find one-way flights on a given date from an origin to a destination airport.",
    type="custom_websocket",
    execution_mode="sync",
    parameters=[
        {
            "type": "string",
            "name": "date",
            "description": "The date of the flight in YYYY-MM-DD format",
            "is_required": True,
        },
        {
            "type": "string",
            "name": "from_airport",
            "description": "The origin airport code",
            "is_required": True,
        },
        {
            "type": "string",
            "name": "to_airport",
            "description": "The destination airport code",
            "is_required": True,
        },
    ],
)

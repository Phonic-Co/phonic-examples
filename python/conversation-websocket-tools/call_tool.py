from dataclasses import asdict

from fast_flights import FlightData, Passengers, Result
from fast_flights import get_flights as get_flights_fn


def get_flights(date: str, from_airport: str, to_airport: str) -> dict:
    result: Result = get_flights_fn(
        flight_data=[
            FlightData(date=date, from_airport=from_airport, to_airport=to_airport)
        ],
        trip="one-way",
        seat="economy",
        passengers=Passengers(
            adults=1, children=0, infants_in_seat=0, infants_on_lap=0
        ),
        fetch_mode="fallback",
    )
    return asdict(result)

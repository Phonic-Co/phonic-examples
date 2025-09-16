This code accompanies the guide [here](TODO).

Environment setup:
1. `uv venv`
2. `source .venv/bin/activate`
3. `uv pip install -r requirements.txt`

The steps to run the server are, after updating `constants.py`:
1. `python create_agent.py`
2. `fastapi dev server.py --port 8080`
3. Call your Twilio number!

If you would like to make an outbound call from your server, run (in addition to the previous steps):
1. `python outbound.py`
2. Pick up the phone!

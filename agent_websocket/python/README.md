This code accompanies the guide [here](TODO).

Environment setup:
1. `uv venv`
2. `source .venv/bin/activate`
3. `uv pip install -r requirements.txt`

The steps to run are, after updating `constants.py`:
1. `python create_agent.py`
2. `fastapi dev server.py --port 8080`
3. Call your Twilio number!

"""Modal deploy wrapper for the deep-redaction demo client (PHO-3540).

Serves the FastAPI app from ``server_deep_redaction.py`` as a public Modal asgi app, so the demo needs
no ngrok: Twilio hits ``/inbound`` and streams to ``/ws`` directly on the Modal URL. Kept warm
(``min_containers=1``) so a call never lands on a cold start.

Deploy:  modal deploy server_deep_redaction_modal.py --env dev
The secret ``deep-redaction-client-env`` supplies ``PHONIC_API_KEY`` and ``NGROK_URL`` (set the latter
to this app's own https URL so the ``/inbound`` TwiML streams back to the same host).
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.117.1",
        "phonic==0.32.9",
        "twilio==9.8.1",
        "python-dotenv==1.1.1",
        "uvicorn==0.32.0",  # imported at module top in server_deep_redaction (only used under __main__)
    )
    .add_local_python_source("server_deep_redaction")
)

app = modal.App("deep-redaction-client")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("deep-redaction-client-env")],
    min_containers=1,
    max_containers=4,
    timeout=3600,
)
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def web():
    from server_deep_redaction import app as fastapi_app

    return fastapi_app

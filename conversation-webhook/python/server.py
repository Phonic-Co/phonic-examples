import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from svix.webhooks import Webhook

load_dotenv(".env.local")

app = FastAPI()

config_webhook_authorization = os.getenv(
    "PHONIC_CONFIG_WEBHOOK_AUTHORIZATION", "Bearer authorization_key"
)
phonic_webhook_secret = os.getenv("PHONIC_WEBHOOK_SECRET")


@app.post("/webhooks/phonic-config")
async def phonic_config(request: Request) -> JSONResponse:
    if request.headers.get("Authorization") != config_webhook_authorization:
        raise HTTPException(status_code=400, detail="Bad Request")

    body = await request.json()
    print(body)
    agent = body["agent"]
    agent_default_system_prompt = agent["system_prompt"]

    response = {
        "welcome_message": "Hey {{customer_name}}, how can I help you today?",
        "system_prompt": f"{agent_default_system_prompt} The customer is visiting 1 week from now.",
        "template_variables": {"customer_name": "Alice", "interest": "nature"},
    }

    return JSONResponse(content=response)


@app.post("/webhooks/events")
async def events_webhook(request: Request) -> Response:
    if not phonic_webhook_secret:
        raise HTTPException(status_code=400, detail="Bad Request")

    raw_body = await request.body()

    signature = request.headers.get("svix-signature", "")
    svix_id = request.headers.get("svix-id", "")
    svix_timestamp = request.headers.get("svix-timestamp", "")

    try:
        wh = Webhook(phonic_webhook_secret)
        headers = {
            "svix-signature": signature,
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
        }
        payload = wh.verify(raw_body, headers)
        print("Events webhook payload:", payload)

        return Response(content="OK", status_code=200)
    except Exception as error:
        print("Failed to verify webhook:", error)
        raise HTTPException(status_code=400, detail="Bad Request")


@app.post("/webhooks/add-destination")
async def add_destination(request: Request) -> JSONResponse:
    destination_name = request.query_params.get("destination_name")

    print("add-destination webhook tool called for destination:", destination_name)

    response = {
        "success": True,
        "message": f"Destination {destination_name} added to the list of destinations",
    }

    return JSONResponse(content=response)


if __name__ == "__main__":
    port = 3000
    print(f"Listening on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)

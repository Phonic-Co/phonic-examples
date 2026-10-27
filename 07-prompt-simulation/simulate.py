#!/usr/bin/env python3
"""Generate Phonic response candidates or replay a recorded turn; no tools execute."""
import argparse
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["responses", "replay"])
    parser.add_argument("request", type=Path, help="JSON request body")
    parser.add_argument("--item-id", help="Completed assistant item ID, required for replay")
    parser.add_argument("--dry-run", action="store_true", help="Print request without sending it")
    args = parser.parse_args()
    if args.mode == "replay" and not args.item_id:
        parser.error("--item-id is required for replay")
    if args.mode == "responses" and args.item_id:
        parser.error("--item-id applies only to replay")
    payload = json.loads(args.request.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        parser.error("request body must be a JSON object")
    path = "/responses" if args.mode == "responses" else f"/conversation_items/{quote(args.item_id, safe='')}/replay"
    url = "https://api.phonic.ai/v1" + path
    if args.dry_run:
        print(json.dumps({"url": url, "body": payload}, indent=2))
        return
    key = os.environ.get("PHONIC_API_KEY")
    if not key:
        parser.error("set PHONIC_API_KEY before sending a request")
    request = Request(url, data=json.dumps(payload).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    try:
        with build_opener(NoRedirect()).open(request, timeout=120) as response:
            print(json.dumps(json.load(response), indent=2))
    except HTTPError as error:
        print(f"Phonic returned HTTP {error.code}: {error.read().decode(errors='replace')}", file=sys.stderr)
        if error.code == 404 and args.mode == "responses":
            print("Responses is experimental; verify that your workspace has access.", file=sys.stderr)
        sys.exit(1)
    except (URLError, TimeoutError) as error:
        print(f"Request failed; no automatic retry: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

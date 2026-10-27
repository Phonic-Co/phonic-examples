# Phonic Examples

Runnable examples for building and testing [Phonic](https://phonic.ai) voice agents. Read the [current documentation](https://docs.phonic.ai) for API contracts.

## Choose an example

| Goal | Example |
| --- | --- |
| Create an agent and place an outbound call | [Quick start](01-quick-start) (Python / Node) |
| Handle conversation webhooks | [Conversation webhook](02-conversation-webhook) (Python / Node) |
| Stream audio through your server | [Conversation WebSocket](03-conversation-websocket) (Python / Node) |
| Implement tools over a WebSocket | [WebSocket tools](04-conversation-websocket-tools) (Python / Node) |
| Bridge Telnyx media streaming | [Telnyx](05-telnyx-media-streaming) |
| Watch an existing conversation's transcript and audio | [Browser live preview](06-conversation-browser/node) |
| Test prompts with synthetic histories or recorded turns | [Prompt simulation](07-prompt-simulation) (Python, no dependencies) |

The browser live preview is read-only monitoring, not a microphone conversation. For a browser voice application, see [phonic-web-demo](https://github.com/Phonic-Co/phonic-web-demo).

## Use a coding assistant

Install the [official Phonic skills/plugin](https://github.com/Phonic-Co/skills) for MCP setup, replay and Responses workflows, live steering, and voice selection. The API MCP is `https://mcp.phonic.ai/mcp`; public documentation search is available separately at `https://docs.phonic.ai/_mcp/server`.

Choose and preview voices on the [voices page](https://phonic.ai/voices). For live steering, use the documented `add_system_message` message on the active STS connection; it differs from updating a saved agent or watching the live monitoring socket.

Follow each example's README for setup. Keep `PHONIC_API_KEY` on the server and out of browser code and commits. Outbound-call examples place real calls when executed; choose a recipient who expects the test. The prompt-simulation example includes a local `--dry-run` that makes no request.

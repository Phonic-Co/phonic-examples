# Prompt simulation and recorded-turn replay

Use **Responses** to supply a synthetic or edited history. Use **conversation-item replay** to test an existing completed assistant turn. These examples generate candidate replies/tool proposals; they do not execute proposed business tools, place a phone call, or update an agent. Whole-conversation audio replay is a different API.

Requires Python 3.10+ and its standard library. Run from this directory. Preview the request without credentials or API usage:

```bash
python3 simulate.py responses responses.json --dry-run
```

Set `PHONIC_API_KEY` securely in your environment, then omit `--dry-run` to send the request. Generations consume API usage. Responses is experimental and requires workspace enablement; a 404 can indicate missing access.

For recorded turns, replace the ID with a completed assistant item from a conversation whose transcripts are retained:

```bash
python3 simulate.py replay replay.json --item-id item_YOUR_ID
```

The replay fixture omits `system_prompt` to establish an as-recorded baseline. Copy it and add your candidate `system_prompt` to compare a change. Keep the case set, rubric, and sample count fixed. Inspect returned text AND tool names/arguments; fluent text is not proof of correct behavior. Report failed requests and sample counts, and verify a candidate on held-out turns before changing production.

To simulate another turn with Responses, choose one candidate and construct the next `input` using the current API schema. Preserve tool-call IDs and supply matching tool outputs immediately after assistant tool calls. Do not concatenate alternative candidates into a single history or execute real side effects just to continue a simulation. These text experiments do not evaluate audio quality or live interruption timing.

Output can contain sensitive conversation text or tool configuration. Inspect locally and avoid committing run outputs. The runner intentionally makes a single request without automatic retries.

- [Responses contract](https://docs.phonic.ai/api-reference/responses/create)
- [Recorded-turn replay](https://docs.phonic.ai/api-reference/conversation-items/replay)
- [Replay guide](https://docs.phonic.ai/docs/build/agents/replay)
- [Phonic product skills](https://github.com/Phonic-Co/skills)

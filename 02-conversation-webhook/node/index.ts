import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { Hono } from "hono";
import { type Phonic, PhonicClient } from "phonic";
import { Webhook } from "svix";

config({ path: ".env.local" });

const configWebhookAuthorization =
  process.env.PHONIC_CONFIG_WEBHOOK_AUTHORIZATION ?? "Bearer authorization_key";
const phonicWebhookSigningSecret = process.env.PHONIC_WEBHOOK_SIGNING_SECRET;
const phonicApiKey = process.env.PHONIC_API_KEY;
const phonicApiUrl = process.env.PHONIC_API_URL ?? "https://api.phonic.ai";
const phonicV1Url = phonicApiUrl.endsWith("/v1")
  ? phonicApiUrl
  : new URL("/v1", phonicApiUrl).toString().replace(/\/$/, "");
const phonicClient = new PhonicClient({
  apiKey: phonicApiKey,
  baseUrl: phonicApiUrl,
});

const app = new Hono();

const isLocalPreviewRequest = (url: string) => {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
};

app.get("/live-preview", (c) => {
  if (!isLocalPreviewRequest(c.req.url)) return c.notFound();
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Phonic live preview</title>
    <style>
      body { max-width: 720px; margin: 3rem auto; padding: 0 1rem; font: 16px system-ui; }
      form { display: flex; gap: .5rem; }
      input { flex: 1; padding: .65rem; }
      button { padding: .65rem 1rem; }
      audio { width: 100%; margin: 1.5rem 0; }
      #status { color: #555; }
      #transcript { white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>Phonic live preview</h1>
    <form id="connect-form">
      <input id="conversation-id" placeholder="conv_..." required>
      <button>Connect</button>
    </form>
    <audio id="audio" controls autoplay></audio>
    <p id="status">Enter an active conversation ID.</p>
    <pre id="transcript"></pre>
    <script src="/live-preview/hls.js"></script>
    <script>
      const form = document.querySelector("#connect-form");
      const input = document.querySelector("#conversation-id");
      const audio = document.querySelector("#audio");
      const status = document.querySelector("#status");
      const transcript = document.querySelector("#transcript");
      input.value = new URLSearchParams(location.search).get("conversation_id") || "";

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.textContent = "Creating a short-lived session...";
        const conversationId = input.value.trim();
        const response = await fetch("/live-preview/session-token", { method: "POST" });
        if (!response.ok) throw new Error(await response.text());
        const { session_token: token, api_url: apiUrl } = await response.json();
        const wsUrl = new URL(apiUrl + "/conversations/" + encodeURIComponent(conversationId) + "/live/ws");
        wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
        wsUrl.searchParams.set("session_token", token);
        const socket = new WebSocket(wsUrl);
        let hls;

        socket.addEventListener("open", () => { status.textContent = "Connected; waiting for audio..."; });
        socket.addEventListener("close", () => { status.textContent = "Conversation closed."; });
        socket.addEventListener("error", () => { status.textContent = "Live connection failed."; });
        socket.addEventListener("message", ({ data }) => {
          const message = JSON.parse(data);
          if (message.type === "conversation-updated") {
            transcript.textContent = message.conversation?.live_transcript || "";
          }
          if (message.type === "conversation-audio") {
            if (!Hls.isSupported()) {
              status.textContent = "HLS.js is not supported in this browser.";
              return;
            }
            hls?.destroy();
            hls = new Hls();
            const advertisedUrl = new URL(message.url);
            const playlistUrl = new URL(
              "/live-preview/api" + advertisedUrl.pathname.replace(/^\\/v1/, ""),
              location.origin,
            );
            playlistUrl.searchParams.set("session_token", token);
            hls.loadSource(playlistUrl.toString());
            hls.attachMedia(audio);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              status.textContent = "Live audio ready.";
              audio.play().catch(() => { status.textContent = "Press play to hear live audio."; });
            });
          }
        });
      });
    </script>
  </body>
</html>`);
});

app.get("/live-preview/hls.js", (c) => {
  if (!isLocalPreviewRequest(c.req.url)) return c.notFound();
  c.header("Content-Type", "text/javascript; charset=utf-8");
  return c.body(readFileSync("node_modules/hls.js/dist/hls.min.js"));
});

app.post("/live-preview/session-token", async (c) => {
  if (!isLocalPreviewRequest(c.req.url)) return c.notFound();
  if (!phonicApiKey) return c.text("Missing PHONIC_API_KEY", 500);
  const token = await phonicClient.auth.createSessionToken({
    ttl_seconds: 300,
  });
  return c.json({ ...token, api_url: phonicV1Url });
});

app.get("/live-preview/api/*", async (c) => {
  if (!isLocalPreviewRequest(c.req.url)) return c.notFound();
  const path = c.req.path.replace("/live-preview/api", "");
  if (
    !/^\/conversations\/conv_[^/]+\/live\/(audio\.m3u8|segments\/segment-\d+\.ts)$/.test(
      path,
    )
  ) {
    return c.text("Not Found", 404);
  }

  const upstreamUrl = new URL(path.replace(/^\//, ""), `${phonicV1Url}/`);
  upstreamUrl.search = new URL(c.req.url).search;
  const response = await fetch(upstreamUrl);
  const headers = new Headers(response.headers);
  headers.delete("cross-origin-resource-policy");
  const isPlaylist = path.endsWith("audio.m3u8");
  const sessionToken = new URL(c.req.url).searchParams.get("session_token");
  const body =
    isPlaylist && sessionToken
      ? (await response.text())
          .replaceAll("/v1/conversations/", "/live-preview/api/conversations/")
          .split("\n")
          .map((line) =>
            line.startsWith("/live-preview/api/")
              ? `${line}?session_token=${encodeURIComponent(sessionToken)}`
              : line,
          )
          .join("\n")
      : response.body;
  if (isPlaylist) {
    headers.delete("content-length");
    headers.delete("transfer-encoding");
  }
  return new Response(body, {
    status: response.status,
    headers,
  });
});

app.post("/webhooks/phonic-config", async (c) => {
  if (c.req.header("Authorization") !== configWebhookAuthorization) {
    return c.text("Bad Request", 400);
  }

  const body =
    (await c.req.json()) as Phonic.PhonicConfigurationEndpointRequestPayload;
  const response: Phonic.PhonicConfigurationEndpointResponsePayload = {
    welcome_message: "Hey {{customer_name}}, how can I help you today?",
    system_prompt: `
        ${body.agent.system_prompt}
        The customer is visiting 1 week from now.
      `.trim(),
    template_variables: {
      customer_name: "Alice",
      interest: "nature",
    },
  };

  return c.json(response);
});

app.post("/webhooks/events", async (c) => {
  if (!phonicWebhookSigningSecret) {
    return c.text("Bad Request", 400);
  }

  const rawBody = await c.req.text();

  console.log("Events webhook raw body:", rawBody);
  const wh = new Webhook(phonicWebhookSigningSecret);

  try {
    const payload = wh.verify(rawBody, {
      "svix-id": c.req.header("svix-id") ?? "",
      "svix-timestamp": c.req.header("svix-timestamp") ?? "",
      "svix-signature": c.req.header("svix-signature") ?? "",
    });

    // Do something with the payload
    console.log("Events webhook payload:", payload);

    return c.text("OK", 200);
  } catch (error) {
    console.error("Failed to verify webhook:", error);

    return c.text("Bad Request", 400);
  }
});

app.post("/webhooks/add-destination", async (c) => {
  const destinationName = c.req.query("destination_name");

  // Do something with the destination name
  console.log(
    "add-destination webhook tool called for destination:",
    destinationName,
  );

  return c.json({
    success: true,
    message: `Destination ${destinationName} added to the list of destinations`,
  });
});

const port = 3000;
serve({
  fetch: app.fetch,
  port,
});

console.log(`Listening on port ${port}`);

import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { Hono } from "hono";
import { PhonicClient } from "phonic";

config({ path: ".env.local" });

const apiKey = process.env.PHONIC_API_KEY;
const apiUrl = "https://api.phonic.ai/v1";

if (!apiKey) throw new Error("Missing PHONIC_API_KEY");

const client = new PhonicClient({ apiKey });
const app = new Hono();

app.get("/", (c) => c.html(readFileSync("browser-live-preview.html", "utf8")));

app.get("/hls.js", (c) => {
  c.header("Content-Type", "text/javascript; charset=utf-8");
  return c.body(readFileSync("node_modules/hls.js/dist/hls.min.js"));
});

app.post("/session-token", async (c) => {
  const token = await client.auth.createSessionToken({ ttl_seconds: 300 });
  return c.json({ ...token, api_url: apiUrl });
});

app.get("/api/*", async (c) => {
  const path = c.req.path.replace("/api", "");
  if (
    !/^\/conversations\/conv_[^/]+\/live\/(audio\.m3u8|segments\/segment-\d+\.ts)$/.test(
      path,
    )
  ) {
    return c.notFound();
  }

  const upstreamUrl = new URL(path.replace(/^\//, ""), `${apiUrl}/`);
  upstreamUrl.search = new URL(c.req.url).search;
  const response = await fetch(upstreamUrl);
  const headers = new Headers(response.headers);
  const isPlaylist = path.endsWith("audio.m3u8");
  const token = new URL(c.req.url).searchParams.get("session_token");
  const body =
    isPlaylist && token
      ? (await response.text())
          .replaceAll("/v1/conversations/", "/api/conversations/")
          .split("\n")
          .map((line) =>
            line.startsWith("/api/")
              ? `${line}?session_token=${encodeURIComponent(token)}`
              : line,
          )
          .join("\n")
      : response.body;

  if (isPlaylist) headers.delete("content-length");
  headers.delete("cross-origin-resource-policy");
  headers.delete("transfer-encoding");
  return new Response(body, { status: response.status, headers });
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3000 });
console.log("Browser live preview: http://localhost:3000");

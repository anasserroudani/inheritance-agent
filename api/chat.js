// Same endpoint as server.js, for Vercel (api/ folder = serverless function).
import { createProvider } from "../agent/providers.js";
import { chatEndpoint } from "../agent/chat-handler.js";

let provider;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    provider ??= createProvider();
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: "The assistant is not configured." });
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const out = await chatEndpoint(provider, ip, req.body);
  res.status(out.status).json(out.json);
}

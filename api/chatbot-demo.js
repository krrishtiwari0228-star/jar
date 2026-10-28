const DEFAULT_BASE_URL = "https://9router.com/v1";
const DEFAULT_MODEL = "cc/claude-sonnet-4-20250514";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST for chat requests." });
  }

  const slot = Number(req.body?.keySlot);
  if (![1, 2, 3].includes(slot)) {
    return res.status(400).json({ error: "Choose API key slot 1, 2, or 3." });
  }

  const key = process.env[`XPL_API_KEY_${slot}`];
  if (!key) {
    return res.status(503).json({
      error: `Key slot ${slot} is not configured. Add XPL_API_KEY_${slot} in Vercel Environment Variables.`,
      code: "KEY_NOT_CONFIGURED"
    });
  }

  const inputMessages = req.body?.messages;
  if (!Array.isArray(inputMessages) || inputMessages.length < 1 || inputMessages.length > 20) {
    return res.status(400).json({ error: "Send between 1 and 20 messages." });
  }

  const messages = inputMessages.map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content ?? "").slice(0, 8000)
  })).filter((m) => m.content.trim());

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Your latest message must be a non-empty user message." });
  }

  const base = (process.env.NINEROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = String(req.body?.model || process.env.CHATBOT_MODEL || DEFAULT_MODEL).slice(0, 160);

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a helpful, concise demo chatbot. If asked about your setup, explain that this is an API connection test." },
          ...messages
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 700
      }),
      signal: AbortSignal.timeout(45000)
    });

    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!upstream.ok) {
      const upstreamMessage = data?.error?.message || data?.message || "";
      const safeMessage = upstream.status === 401 || upstream.status === 403
        ? "Authentication failed. Check that this key is valid for the configured 9Router endpoint."
        : upstream.status === 429
          ? "Rate limit or quota reached for this key."
          : upstream.status >= 500
            ? "The upstream AI service returned a server error."
            : (upstreamMessage || `Upstream request failed (HTTP ${upstream.status}).`).slice(0, 350);
      return res.status(upstream.status === 429 ? 429 : 502).json({
        error: safeMessage,
        upstreamStatus: upstream.status,
        code: upstream.status === 401 || upstream.status === 403 ? "AUTH_FAILED" : upstream.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR"
      });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) {
      return res.status(502).json({ error: "The API responded, but no assistant message was found. Check the model name.", code: "EMPTY_RESPONSE" });
    }

    return res.status(200).json({
      ok: true,
      answer: typeof answer === "string" ? answer : JSON.stringify(answer),
      model: data.model || model,
      keySlot: slot,
      usage: data.usage || null
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(502).json({
      error: timeout ? "The API request timed out after 45 seconds." : "Could not reach the API endpoint. Check the base URL and network.",
      code: timeout ? "TIMEOUT" : "CONNECTION_ERROR"
    });
  }
}

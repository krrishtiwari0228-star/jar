# ANIZLUX API Chatbot Demo

This demo is isolated from the main ANIZLUX UI. Deploy it on a preview deployment first.

## Files
- `chatbot-demo.html`: responsive chat UI at `/chatbot-demo.html`
- `api/chatbot-demo.js`: server-side API proxy; secrets never go to browser code

## Vercel environment variables
Add these in **Vercel → Project → Settings → Environment Variables**. Set them only for Preview until tested.

- `XPL_API_KEY_1` = full API key for slot 1
- `XPL_API_KEY_2` = full API key for slot 2
- `XPL_API_KEY_3` = full API key for slot 3
- `NINEROUTER_BASE_URL` = `https://9router.com/v1` (or your own reachable 9Router endpoint ending before `/v1`)
- `CHATBOT_MODEL` = optional default model, e.g. `cc/claude-sonnet-4-20250514`

Never commit API keys into Git, HTML, JavaScript, or chat messages. If a key has been posted publicly or committed, revoke/rotate it.

After setting variables, redeploy the Preview deployment. Open `/chatbot-demo.html`, select a slot, click **Test key**, and then send a message. The app sends a small chat-completions request; this may use provider quota.

## Diagnostics
- Key slot not configured: matching environment variable is missing from the deployment.
- Authentication failed: key invalid, revoked, or not accepted by the configured endpoint.
- Rate limit/quota: provider quota or request rate limit was reached.
- Connection error: verify the base URL is reachable from Vercel.
- Empty response/model error: choose a model ID available to your 9Router instance.

The API route uses the OpenAI-compatible `/chat/completions` endpoint and returns generic errors without echoing API keys or raw upstream responses.

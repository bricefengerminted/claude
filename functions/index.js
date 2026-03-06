const { onRequest } = require("firebase-functions/v2/https");

/**
 * Proxy for Anthropic API to avoid CORS issues in the browser.
 * The API key is sent from the client (stored in localStorage).
 */
exports.anthropicProxy = onRequest(
  { cors: true, region: "us-central1", memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      res.status(400).json({ error: "Missing x-api-key header" });
      return;
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": req.headers["anthropic-version"] || "2023-06-01",
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err) {
      console.error("Anthropic proxy error:", err);
      res.status(500).json({ error: "Proxy request failed" });
    }
  }
);

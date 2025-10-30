export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

  try {
    // Force model to a valid version (latest Claude Sonnet 4.5)
    const updatedBody = {
      ...req.body,
      model: "claude-sonnet-4-5-20250929",
      max_tokens: req.body.max_tokens || 500
    };
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(updatedBody)
    });

    const data = await response.json();
        // If Claude API returns an error, forward it
    if (data.error) {
      console.error("Claude API Error:", data.error);
      return res.status(400).json({ error: data.error.message || "Claude API error" });
    }
    res.status(200).json(data);
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Error connecting to Claude API" });
  }
}

// Função serverless (Vercel). Recebe { prompt } e devolve { text }.
// A chave fica na variável de ambiente GEMINI_API_KEY, fora do código do navegador.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_PROMPT_CHARS = 60000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "missing_api_key" });
  }

  const prompt = req.body && typeof req.body.prompt === "string" ? req.body.prompt : "";
  if (!prompt.trim()) {
    return res.status(400).json({ error: "empty_prompt" });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(413).json({ error: "prompt_too_large" });
  }

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!upstream.ok) {
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: "upstream_error" });
    }

    const data = await upstream.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    if (!text) {
      return res.status(502).json({ error: "empty_completion" });
    }
    return res.status(200).json({ text: text });
  } catch (e) {
    return res.status(502).json({ error: "upstream_error" });
  }
};

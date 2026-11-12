
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_PROMPT_CHARS = 60000;

async function callGemini(prompt, key) {
  const upstream = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );

  if (!upstream.ok) {
    let detail = "";
    try {
      const err = await upstream.json();
      detail = (err && err.error && err.error.message) || "";
    } catch (e) { /* sem corpo legível */ }
    return { ok: false, status: upstream.status, detail: detail };
  }

  const data = await upstream.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts) || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  return { ok: true, status: 200, text: text };
}

module.exports = async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  if (req.method === "GET" && req.query && req.query.teste) {
    if (!key) {
      return res.status(200).json({ model: MODEL, temChave: false });
    }
    try {
      const r = await callGemini("Responda apenas: ok", key);
      return res.status(200).json({ model: MODEL, temChave: true, ok: r.ok, status: r.status, detail: r.detail || "", resposta: r.text || "" });
    } catch (e) {
      return res.status(200).json({ model: MODEL, temChave: true, ok: false, detail: "falha de rede ao chamar o Google" });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

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
    const r = await callGemini(prompt, key);
    if (!r.ok) {
      console.error("Gemini respondeu", r.status, r.detail);
      return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream_error", status: r.status });
    }
    if (!r.text) {
      return res.status(502).json({ error: "empty_completion" });
    }
    return res.status(200).json({ text: r.text });
  } catch (e) {
    console.error("Falha de rede ao chamar o Gemini", e && e.message);
    return res.status(502).json({ error: "upstream_error" });
  }
};

/*
 * Camada de compatibilidade do Resumê.
 *
 * O app foi escrito para pedir "IA" através de window.claude.use("sample").
 * Aqui essa função é implementada chamando a rota /api/gemini (api/gemini.js),
 * que guarda a chave do Gemini no servidor. O navegador nunca vê a chave.
 *
 * Armazenamento: window.claude.use("db") devolve null, então o app salva
 * tudo no localStorage do próprio navegador.
 */
(function () {
  "use strict";

  async function ask(prompt) {
    var res;
    try {
      res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt })
      });
    } catch (e) {
      throw { code: "upstream_error", message: "Sem conexão com o servidor." };
    }
    if (!res.ok) {
      throw {
        code: res.status === 429 ? "rate_limited" : "upstream_error",
        message: "A API respondeu com status " + res.status + "."
      };
    }
    var data = await res.json();
    if (!data || !data.text) {
      throw { code: "empty_completion", message: "Resposta vazia." };
    }
    return data.text;
  }

  function toPrompt(input) {
    if (typeof input === "string") return input;
    return input.map(function (m) { return m.content; }).join("\n\n");
  }

  async function sample(input) {
    var text = await ask(toPrompt(input));
    return { text: text, truncated: false };
  }

  // Lê o JSON mesmo que venha dentro de ```json ... ``` ou com texto ao redor.
  function parseJson(text) {
    var clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { return JSON.parse(clean); } catch (e) { /* tenta recortar */ }
    var start = clean.search(/[\[{]/);
    var end = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
    if (start === -1 || end <= start) {
      throw { code: "invalid_json", message: "A resposta não veio em JSON.", text: text };
    }
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (e) {
      throw { code: "invalid_json", message: "JSON inválido.", text: text };
    }
  }

  sample.json = async function (input) {
    var res = await sample(input);
    return parseJson(res.text);
  };

  window.claude = {
    use: async function (name) {
      return name === "sample" ? sample : null;
    }
  };

  // PWA: permite instalar o app e abrir o histórico mesmo sem internet.
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();

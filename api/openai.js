// api/openai.js — versão otimizada e resiliente
import OpenAI from "openai";

// Cache simples em memória (reseta a cada reinício do server)
const cache = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      console.error("❌ OPENAI_API_KEY ausente.");
      return res.status(500).json({ error: "Chave da OpenAI não configurada." });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt inválido ou ausente." });
    }

    // 🔹 Cache básico para evitar requisições repetidas
    if (cache.has(prompt)) {
      return res.status(200).json({ result: cache.get(prompt) });
    }

    const client = new OpenAI({ apiKey: key });

    const completion = await client.chat.completions.create({
      model: "gpt-4-turbo", // tenta gpt-4-turbo (mais barato e rápido)
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em cinema. Sua função é interpretar o pedido do usuário e responder SOMENTE no formato: Gênero1,Gênero2,...|Filme ou Série. Não explique nada além disso.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 30,
      temperature: 0.2,
    });

    let message =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "Ação|Filme";

    // 🔹 Garante formato válido mesmo se o modelo responder errado
    if (!message.includes("|")) message = "Ação|Filme";
    message = message.replace(/[^\p{L}\p{N},| ]/gu, "").trim();

    cache.set(prompt, message); // salva no cache

    return res.status(200).json({ result: message });
  } catch (err) {
    console.error("❌ Erro na rota /api/openai:", err.message);

    // Fallback automático para GPT-3.5 se o GPT-4 falhar
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Responda SOMENTE no formato: Gênero1,Gênero2,...|Filme ou Série.",
          },
          { role: "user", content: req.body.prompt },
        ],
        max_tokens: 30,
        temperature: 0.3,
      });
      const msg = completion?.choices?.[0]?.message?.content?.trim() || "Ação|Filme";
      return res.status(200).json({ result: msg });
    } catch (fallbackError) {
      console.error("❌ Fallback também falhou:", fallbackError.message);
      return res.status(500).json({
        error: "Falha ao processar o prompt. Tente novamente em alguns segundos.",
      });
    }
  }
}

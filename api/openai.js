// /api/openai.js
import OpenAI from "openai";

const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // 👈 libera acesso de qualquer origem
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt é obrigatório" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    res.status(200).json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error("Erro OpenAI:", err);
    res.status(500).json({ error: "Erro ao processar solicitação." });
  }
}

export default allowCors(handler);

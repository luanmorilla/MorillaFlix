import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // 🔑 Verifica se a variável de ambiente está disponível
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ ERRO: OPENAI_API_KEY não está definida no ambiente da Vercel.");
      return res.status(500).json({ error: "Chave da OpenAI ausente no servidor." });
    }

    // ✅ Inicializa cliente apenas quando necessário
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("📩 Body recebido:", req.body);
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      console.warn("❌ Prompt inválido:", prompt);
      return res.status(400).json({ error: "Prompt inválido" });
    }

    console.log("🤖 Enviando prompt para OpenAI:", prompt);

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.7,
    });

    console.log("✅ Resposta bruta da OpenAI:", completion);

    const message = completion?.choices?.[0]?.message?.content || "Sem resposta da IA";
    res.status(200).json({ result: message });

  } catch (error) {
    console.error("❌ Erro detalhado na API OpenAI:", error);
    res.status(500).json({
      error: error?.message || "Erro interno da IA",
      stack: error?.stack || "Sem stack trace"
    });
  }
}

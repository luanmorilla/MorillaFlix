import OpenAI from "openai";

export default async function handler(req, res) {
  console.log("🔑 CHAVE CARREGADA NO SERVIDOR:", process.env.OPENAI_API_KEY);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ ERRO: OPENAI_API_KEY não está definida.");
      return res.status(500).json({ error: "Chave da OpenAI ausente." });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt inválido" });
    }

    // ✅ Prompt aprimorado
    const completion = await client.chat.completions.create({
      model: "gpt-4", // ou "gpt-3.5-turbo" se não tiver gpt-4
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em cinema. Sua função é interpretar pedidos do usuário e retornar SOMENTE o gênero e o tipo no formato: Gênero|Filme ou Gênero|Série. Exemplos: 'Ação|Filme', 'Comédia|Filme', 'Terror|Série'. Não explique, não responda mais nada além do formato solicitado.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 50,
      temperature: 0.3,
    });

    const message = completion?.choices?.[0]?.message?.content || "Sem resposta da IA";
    console.log("✅ Resposta da OpenAI:", message);
    return res.status(200).json({ result: message });

  } catch (error) {
    console.error("❌ Erro detalhado na API OpenAI:", error);
    return res.status(500).json({
      error: error?.message || "Erro interno da IA",
      stack: error?.stack || "Sem stack trace disponível",
    });
  }
}

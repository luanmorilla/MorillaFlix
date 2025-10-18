import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("📩 Body recebido:", req.body);

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      console.log("❌ Prompt inválido:", prompt);
      return res.status(400).json({ error: "Prompt inválido" });
    }

    console.log("🤖 Enviando para OpenAI:", prompt);

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
    res.status(500).json({ error: error.message || "Erro interno da IA" });
  }
}

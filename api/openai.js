import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt é obrigatório" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 100,
    });

    const message = completion?.choices?.[0]?.message?.content || "";
    res.status(200).json({ result: message });
  } catch (error) {
    console.error("❌ Erro na API OpenAI:", error);
    res.status(500).json({ error: error.message || "Erro interno da IA" });
  }
}

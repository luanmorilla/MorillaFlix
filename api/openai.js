import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Verifica se o método é POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { prompt } = req.body;

    // Validação básica
    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Prompt é obrigatório" });
    }

    // Chamada para a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    // Retorna o texto gerado para o frontend
    res.status(200).json({
      result: completion.choices[0].message.content,
    });

  } catch (err) {
    console.error("Erro na API OpenAI:", err.message);

    // Retorno seguro para o frontend
    res.status(500).json({
      error: "Não foi possível processar a sua pergunta no momento. Tente novamente.",
    });
  }
}

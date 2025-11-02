import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Chave da OpenAI ausente." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt inválido" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente que interpreta pedidos de filmes e séries em português e responde **somente no formato**:
Gênero1,Gênero2,...|Filme ou Série

Regras:
- Nunca invente gênero inexistente.
- Se a frase tiver palavras como "triste", "depressivo" ou "chateado", responda: Comédia,Romance|Filme
- Se a frase tiver "animado", "feliz", "motivado", responda: Ação,Aventura|Filme
- Se a frase tiver "assustado", "medo", "tenso", responda: Terror,Thriller|Filme
- Se a frase tiver "entediado", responda: Fantasia,Comédia|Filme
- Se a frase tiver "romântico", "apaixonado", responda: Romance,Drama|Filme
- Se a frase tiver "curioso" ou "pensativo", responda: Mistério,Drama|Filme
- Caso o usuário diga um gênero diretamente (ex: 'quero terror' ou 'filme de ação'), retorne exatamente esse gênero + tipo.
- Sempre prefira filmes a séries, a menos que o usuário diga claramente “série”.
`
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 50,
      temperature: 0.2
    });

    const message = completion?.choices?.[0]?.message?.content || "Sem resposta da IA";
    return res.status(200).json({ result: message });
  } catch (error) {
    console.error("❌ Erro detalhado na API OpenAI:", error);
    return res.status(500).json({
      error: error?.message || "Erro interno da IA"
    });
  }
}

// ============================================================
// /api/openai.js — IA SUPREMA 4.1 (Emocional + Contextual + Ultra Rápida)
// ============================================================

import OpenAI from "openai";

const cache = new Map();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const { prompt } = req.body;

    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "⚠️ OPENAI_API_KEY não configurada." });
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2)
      return res.status(400).json({ error: "Prompt inválido." });

    const cleanPrompt = prompt.trim().toLowerCase();
    if (cache.has(cleanPrompt)) {
      return res.status(200).json({ result: cache.get(cleanPrompt), cached: true });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `
Você é o cérebro emocional e semântico do MorillaFlix.
Seu trabalho é entender o humor, desejo ou gênero mencionado e retornar no formato:
"Gênero1,Gênero2,...|Filme" ou "|Série"

Regras:
- Não use explicações ou frases extras.
- Gêneros válidos: Ação, Aventura, Comédia, Drama, Romance, Terror, Thriller, Ficção científica, Mistério, Fantasia, Família, Animação, Crime, Documentário.
- Máximo 3 gêneros.
- Se o usuário mencionar "série" → "|Série".
- Se não mencionar, use "|Filme".
- Priorize conteúdos recentes (2018+) e de boa avaliação.

Associações de humor:
triste → Comédia,Romance|Filme  
feliz → Ação,Aventura|Filme  
entediado → Fantasia,Comédia|Filme  
assustado → Terror,Thriller|Filme  
romântico → Romance,Drama|Filme  
pensativo → Mistério,Drama|Filme  
familia → Família,Animação|Filme  
futuro → Ficção científica,Ação|Filme  
vingança → Ação,Crime,Thriller|Filme  
história → Drama,Documentário|Filme
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 60,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: cleanPrompt },
      ],
    });

    const message = response?.choices?.[0]?.message?.content?.trim() || "";
    const isValid = /^[A-Za-zÀ-ÿ, ]+\|(Filme|Série)$/.test(message);
    const result = isValid ? message : detectBasicGenre(cleanPrompt);

    cache.set(cleanPrompt, result);
    setTimeout(() => cache.delete(cleanPrompt), 600000);

    return res.status(200).json({ result });
  } catch (error) {
    console.error("❌ Erro na API OpenAI:", error);
    return res.status(500).json({ error: "Erro interno da IA" });
  }
}

function detectBasicGenre(text = "") {
  const t = text.toLowerCase();
  const patterns = [
    [/triste|chateado/, "Comédia,Romance|Filme"],
    [/feliz|animado/, "Ação,Aventura|Filme"],
    [/entediado|sem nada/, "Fantasia,Comédia|Filme"],
    [/medo|assustado/, "Terror,Thriller|Filme"],
    [/romântico|apaixonado/, "Romance,Drama|Filme"],
    [/pensativo|curioso/, "Mistério,Drama|Filme"],
    [/família|criança/, "Família,Animação|Filme"],
    [/futuro|robô/, "Ficção científica,Ação|Filme"],
    [/vingança|violento/, "Ação,Crime,Thriller|Filme"],
    [/história|baseado/, "Drama,Documentário|Filme"],
    [/série/, "Drama|Série"],
  ];
  for (const [regex, out] of patterns) if (regex.test(t)) return out;
  return "Ação,Drama|Filme";
}

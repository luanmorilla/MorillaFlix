// ============================================================
// /api/openai/index.js — IA TURBO PRO 2025 (Busca Inteligente + Emocional)
// ============================================================

import OpenAI from "openai";

// Cache leve em memória (evita chamadas repetidas)
const cache = new Map();

/**
 * 🔥 Interpreta frases naturais e retorna:
 * "Gênero1,Gênero2,...|Filme ou Série"
 * Exemplo: "Comédia,Romance|Filme"
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const { prompt } = req.body;

    // ====== VALIDAÇÕES BÁSICAS ======
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "⚠️ OPENAI_API_KEY não configurada." });
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2)
      return res.status(400).json({ error: "Prompt inválido." });

    const cleanPrompt = prompt.trim().toLowerCase();

    // ====== CACHE LOCAL (anti-latência)
    if (cache.has(cleanPrompt)) {
      return res.status(200).json({ result: cache.get(cleanPrompt), cached: true });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ====== PROMPT INTELIGENTE ======
    const systemPrompt = `
Você é um tradutor emocional e semântico de pedidos de filmes e séries.
Responda SOMENTE no formato:
"Gênero1,Gênero2,...|Filme" ou "|Série"

Regras:
- Nunca inclua emojis, explicações, aspas extras, pontos finais ou texto fora do padrão.
- Gêneros válidos: Ação, Aventura, Comédia, Drama, Romance, Terror, Thriller, Ficção científica, Mistério, Fantasia, Família, Animação, Crime, Documentário.
- Use até 3 gêneros relevantes.
- Priorize filmes populares e atuais.
- Se o usuário mencionar “série”, “temporada” → use "|Série"
- Se mencionar “filme” → use "|Filme"
- Caso não mencione, use "|Filme" por padrão.

Associações emocionais:
• triste / deprimido / chateado → Comédia,Romance|Filme
• feliz / animado / motivado → Ação,Aventura|Filme
• medo / assustado / tenso / ansioso → Terror,Thriller|Filme
• entediado / sem nada pra fazer → Fantasia,Comédia|Filme
• romântico / apaixonado / carente / com saudade → Romance,Drama|Filme
• pensativo / curioso / reflexivo → Mistério,Drama|Filme
• família / criança / leve → Família,Animação|Filme
• tecnologia / futuro / espaço / robô → Ficção científica,Ação|Filme
• violência / vingança / caos → Ação,Crime,Thriller|Filme
• história / baseado em fatos → Drama,Documentário|Filme
`;

    // ====== CHAMADA À OPENAI ======
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 60,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: cleanPrompt }
      ],
    });

    const message = response?.choices?.[0]?.message?.content?.trim() || "";
    const isValid = /^[A-Za-zÀ-ÿ, ]+\|(Filme|Série)$/.test(message);

    // ====== FALLBACK AUTOMÁTICO ======
    const result = isValid ? message : detectBasicGenre(cleanPrompt);

    // Armazena no cache (tempo de vida curto)
    cache.set(cleanPrompt, result);
    setTimeout(() => cache.delete(cleanPrompt), 10 * 60 * 1000); // 10 minutos

    return res.status(200).json({ result });
  } catch (error) {
    console.error("❌ Erro na API OpenAI:", error);
    return res.status(500).json({
      error: "Erro interno da IA",
      details: error?.message || "Falha desconhecida"
    });
  }
}

/**
 * 🧠 Fallback local — garante resposta mesmo sem OpenAI
 */
function detectBasicGenre(text = "") {
  const t = text.toLowerCase();
  const patterns = [
    [/triste|chateado|depressivo/, "Comédia,Romance|Filme"],
    [/feliz|animado|motivado/, "Ação,Aventura|Filme"],
    [/medo|assustado|tenso|ansioso/, "Terror,Thriller|Filme"],
    [/entediado|sem nada pra fazer/, "Fantasia,Comédia|Filme"],
    [/romântico|apaixonado|carente|saudade/, "Romance,Drama|Filme"],
    [/pensativo|curioso|reflexivo/, "Mistério,Drama|Filme"],
    [/família|criança|leve/, "Família,Animação|Filme"],
    [/tecnologia|futuro|robô|espaço/, "Ficção científica,Ação|Filme"],
    [/violento|vingança|caos/, "Ação,Crime,Thriller|Filme"],
    [/história|baseado/, "Drama,Documentário|Filme"],
    [/série|temporada/, "Drama|Série"],
    [/ação/, "Ação|Filme"],
    [/comédia/, "Comédia|Filme"],
    [/terror/, "Terror|Filme"],
  ];
  for (const [regex, out] of patterns) if (regex.test(t)) return out;
  return "Ação,Drama|Filme";
}

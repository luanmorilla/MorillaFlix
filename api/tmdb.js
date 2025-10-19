// api/tmdb.js
// Aceita: GET /api/tmdb?type=movie|tv&genreId=27&page=3
// Repassa `page` para a TMDb, permitindo resultados aleatórios no frontend.

import fetch from "node-fetch";

export default async function handler(req, res) {
  // CORS básico (útil para testes locais abrindo index.html no navegador)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      type = "movie",        // "movie" ou "tv"
      genreId,               // ex: 27
      page = "1",            // ex: 1..500
      language = "pt-BR",    // opcional
      sort_by = "popularity.desc" // opcional
    } = req.query;

    if (!genreId) {
      return res.status(400).json({ error: "Parâmetro 'genreId' é obrigatório." });
    }
    if (type !== "movie" && type !== "tv") {
      return res.status(400).json({ error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." });
    }

    // Monta URL do discover
    let url = `https://api.themoviedb.org/3/discover/${type}?language=${encodeURIComponent(language)}&sort_by=${encodeURIComponent(sort_by)}&with_genres=${encodeURIComponent(genreId)}&page=${encodeURIComponent(page)}`;

    // Preferência: Token de Leitura v4 via header Authorization (mais seguro)
    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY; // fallback para API v3 (?api_key=)

    const headers = {};
    if (TMDB_READ_TOKEN) {
      headers.Authorization = `Bearer ${TMDB_READ_TOKEN}`;
    } else if (TMDB_API_KEY) {
      // Fallback usando v3 api_key na querystring
      url += `&api_key=${encodeURIComponent(TMDB_API_KEY)}`;
    } else {
      return res.status(500).json({
        error: "Configure TMDB_READ_TOKEN (v4) ou TMDB_API_KEY (v3) nas variáveis da Vercel."
      });
    }

    const tmdbRes = await fetch(url, { headers });
    if (!tmdbRes.ok) {
      const text = await tmdbRes.text();
      return res.status(tmdbRes.status).json({
        error: "Erro ao consultar TMDb",
        status: tmdbRes.status,
        body: text
      });
    }

    const data = await tmdbRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("❌ Erro na rota /api/tmdb:", err);
    return res.status(500).json({ error: "Falha interna na rota TMDb" });
  }
}

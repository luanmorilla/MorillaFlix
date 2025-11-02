// api/tmdb/index.js — versão aprimorada (filmes recentes e relevantes)
import fetch from "node-fetch";

export default async function handler(req, res) {
  // ===== CORS (produção e local)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      type = "movie",
      genreId,
      page = "1",
      language = "pt-BR"
    } = req.query;

    if (!genreId) {
      return res.status(400).json({ error: "Parâmetro 'genreId' é obrigatório." });
    }
    if (!["movie", "tv"].includes(type)) {
      return res.status(400).json({ error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." });
    }

    // ===== Parâmetros otimizados para filmes modernos e populares
    const params = new URLSearchParams({
      language,
      sort_by: "popularity.desc",        // 🔥 prioriza relevância atual
      with_genres: genreId,
      "vote_average.gte": "6.5",         // nota mínima
      "vote_count.gte": "200",           // evita filmes desconhecidos
      "primary_release_date.gte": "2018-01-01", // 🔥 apenas filmes de 2018+
      include_adult: "false",
      page
    });

    let url = `https://api.themoviedb.org/3/discover/${type}?${params.toString()}`;

    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;

    const headers = {};
    if (TMDB_READ_TOKEN) {
      headers.Authorization = `Bearer ${TMDB_READ_TOKEN}`;
    } else if (TMDB_API_KEY) {
      url += `&api_key=${encodeURIComponent(TMDB_API_KEY)}`;
    } else {
      return res.status(500).json({
        error: "Configure TMDB_READ_TOKEN (v4) ou TMDB_API_KEY (v3) nas variáveis da Vercel."
      });
    }

    // ===== Chamada TMDB
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

    // ===== Filtro adicional para garantir qualidade visual
    const filtered = (data.results || []).filter(
      item =>
        item &&
        (item.poster_path || item.backdrop_path) &&
        item.vote_average >= 6.5
    );

    return res.status(200).json({
      ...data,
      results: filtered
    });
  } catch (err) {
    console.error("❌ Erro na rota /api/tmdb:", err);
    return res.status(500).json({ error: "Falha interna na rota TMDb" });
  }
}

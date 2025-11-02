// ============================================================
// /api/tmdb/index.js — TMDb Inteligente SUPREMO 4.1
// ============================================================

import fetch from "node-fetch";

const cache = new Map();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Método não permitido" });

  try {
    const {
      type = "movie",
      genreId,
      page = "1",
      language = "pt-BR",
      region = "BR",
      year_from = "2018",
      vote_min = "7.2",
    } = req.query;

    if (!genreId)
      return res.status(400).json({ error: "Parâmetro 'genreId' é obrigatório." });

    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;

    if (!TMDB_READ_TOKEN && !TMDB_API_KEY) {
      return res.status(500).json({
        error: "Configure TMDB_READ_TOKEN ou TMDB_API_KEY nas variáveis.",
      });
    }

    const cacheKey = `${type}_${genreId}_${page}_${language}`;
    if (cache.has(cacheKey))
      return res.status(200).json({ ...cache.get(cacheKey), cached: true });

    const params = new URLSearchParams({
      language,
      include_adult: "false",
      page,
      with_genres: String(genreId),
      sort_by: "vote_average.desc",
      "vote_average.gte": String(vote_min),
      "vote_count.gte": "500",
      region,
    });

    params.set(
      type === "movie" ? "primary_release_date.gte" : "first_air_date.gte",
      `${year_from}-01-01`
    );
    if (TMDB_API_KEY) params.set("api_key", TMDB_API_KEY);

    const url = `https://api.themoviedb.org/3/discover/${type}?${params.toString()}`;
    const headers = TMDB_READ_TOKEN
      ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` }
      : {};

    const data = await fetchWithRetry(url, { headers }, 2, 10000);
    if (!data || !data.results)
      return res.status(502).json({ error: "Resposta inválida do TMDb" });

    const now = new Date().getFullYear();
    const results = data.results
      .filter((it) => {
        const nota = it.vote_average ?? 0;
        const votos = it.vote_count ?? 0;
        const ano = parseInt(
          (it.release_date || it.first_air_date || "0000").slice(0, 4)
        );
        return (
          nota >= parseFloat(vote_min) &&
          votos >= 500 &&
          ano >= parseInt(year_from) &&
          ano <= now &&
          it.poster_path
        );
      })
      .map((it) => ({
        ...it,
        relevance:
          (it.vote_average || 0) * 1.4 +
          Math.log10((it.vote_count || 1) + 1) +
          (parseInt(it.release_date?.slice(0, 4) || 0) >= now - 3 ? 1.5 : 0),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20);

    cache.set(cacheKey, { ...data, results });
    setTimeout(() => cache.delete(cacheKey), 10 * 60 * 1000);

    return res.status(200).json({ results });
  } catch (err) {
    console.error("❌ Erro TMDB:", err);
    return res.status(500).json({ error: "Erro interno TMDb" });
  }
}

async function fetchWithRetry(url, options = {}, retries = 2, timeoutMs = 10000) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeout);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
}

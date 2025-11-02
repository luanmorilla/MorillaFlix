// ============================================================
// /api/tmdb/index.js — TMDb Inteligente PRO 2025
// Curadoria de filmes e séries com IA de relevância, filtros e cache.
// ============================================================

import fetch from "node-fetch";

const cache = new Map(); // 🧠 Cache em memória (10 min por consulta)

/**
 * 🔍 Rota inteligente de descoberta de filmes/séries via TMDb
 */
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
      year_from = "2015",
      vote_min = "7.0",
      orig_lang = "",
    } = req.query;

    if (!genreId)
      return res.status(400).json({ error: "Parâmetro 'genreId' é obrigatório." });

    if (!["movie", "tv"].includes(type))
      return res.status(400).json({ error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." });

    const cacheKey = `${type}_${genreId}_${page}_${language}_${year_from}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      return res.status(200).json({ ...cached, cached: true });
    }

    // ===== Parâmetros refinados
    const params = new URLSearchParams({
      language,
      include_adult: "false",
      page,
      with_genres: String(genreId),
      sort_by: "popularity.desc",
      "vote_average.gte": String(vote_min),
      "vote_count.gte": "300",
      region,
      watch_region: region,
      with_watch_monetization_types: "flatrate|free|ads",
    });

    if (type === "movie") {
      params.set("primary_release_date.gte", `${year_from}-01-01`);
    } else {
      params.set("first_air_date.gte", `${year_from}-01-01`);
    }

    if (orig_lang) params.set("with_original_language", orig_lang);

    const url = `https://api.themoviedb.org/3/discover/${type}?${params.toString()}`;

    // ===== Autenticação segura
    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const headers = {};
    if (TMDB_READ_TOKEN) headers.Authorization = `Bearer ${TMDB_READ_TOKEN}`;
    else if (TMDB_API_KEY) params.append("api_key", TMDB_API_KEY);
    else
      return res.status(500).json({
        error: "Configure TMDB_READ_TOKEN (v4) ou TMDB_API_KEY (v3) nas variáveis da Vercel.",
      });

    // ===== Requisição com timeout e retry
    const data = await fetchWithRetry(url, { headers });

    if (!data || !data.results) {
      return res.status(500).json({ error: "Sem resultados válidos do TMDb." });
    }

    // ===== Filtro de curadoria
    const now = new Date().getFullYear();
    const results = (data.results || [])
      .filter((it) => {
        const nota = it.vote_average ?? 0;
        const votos = it.vote_count ?? 0;
        const ano =
          parseInt((it.release_date || it.first_air_date || "0000").substring(0, 4)) || 0;

        return (
          nota >= parseFloat(vote_min) &&
          votos >= 300 &&
          (it.poster_path || it.backdrop_path) &&
          ano >= parseInt(year_from) &&
          ano <= now
        );
      })
      .map((it) => ({
        ...it,
        relevance:
          (it.vote_average || 0) * 1.4 +
          Math.log10((it.vote_count || 1) + 1) +
          (parseInt((it.release_date || it.first_air_date || "0000").substring(0, 4)) >=
          now - 3
            ? 1.5
            : 0),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 15); // top 15 mais relevantes

    // ===== Cache local (10 min)
    cache.set(cacheKey, { ...data, results });
    setTimeout(() => cache.delete(cacheKey), 10 * 60 * 1000);

    return res.status(200).json({
      ...data,
      results,
      filteredCount: results.length,
    });
  } catch (err) {
    console.error("❌ Erro /api/tmdb:", err);
    return res.status(500).json({ error: "Falha interna na rota TMDb" });
  }
}

/**
 * 🧠 fetch com retry e timeout (resiliente contra quedas TMDb)
 */
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

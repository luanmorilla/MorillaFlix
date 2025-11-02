// api/tmdb/index.js — Filtro Pro (recentes + populares + parâmetros)
import fetch from "node-fetch";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido" });

  try {
    const {
      type = "movie",
      genreId,
      page = "1",
      language = "pt-BR",
      region = "BR",
      year_from = "2018",
      vote_min = "6.5",
      orig_lang = "" // ex: "en" ou "pt"
    } = req.query;

    if (!genreId) return res.status(400).json({ error: "Parâmetro 'genreId' é obrigatório." });
    if (!["movie", "tv"].includes(type)) {
      return res.status(400).json({ error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." });
    }

    const params = new URLSearchParams({
      language,
      sort_by: "popularity.desc",
      include_adult: "false",
      page,
      with_genres: String(genreId),
      "vote_average.gte": String(vote_min),
    });

    if (type === "movie") {
      params.set("primary_release_date.gte", `${year_from}-01-01`);
      params.set("region", region);
    } else {
      // séries: usa first_air_date.gte
      params.set("first_air_date.gte", `${year_from}-01-01`);
    }

    if (orig_lang) params.set("with_original_language", orig_lang);

    let url = `https://api.themoviedb.org/3/discover/${type}?${params.toString()}`;

    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const headers = {};

    if (TMDB_READ_TOKEN) headers.Authorization = `Bearer ${TMDB_READ_TOKEN}`;
    else if (TMDB_API_KEY) url += `&api_key=${encodeURIComponent(TMDB_API_KEY)}`;
    else return res.status(500).json({ error: "Configure TMDB_READ_TOKEN (v4) ou TMDB_API_KEY (v3) na Vercel." });

    const tmdbRes = await fetch(url, { headers });
    if (!tmdbRes.ok) {
      const text = await tmdbRes.text();
      return res.status(tmdbRes.status).json({ error: "Erro ao consultar TMDb", body: text });
    }
    const data = await tmdbRes.json();

    const filtered = (data.results || []).filter(
      it => it && (it.poster_path || it.backdrop_path) && (it.vote_average ?? 0) >= parseFloat(vote_min)
    );

    return res.status(200).json({ ...data, results: filtered });
  } catch (err) {
    console.error("❌ /api/tmdb erro:", err);
    return res.status(500).json({ error: "Falha interna na rota TMDb" });
  }
}

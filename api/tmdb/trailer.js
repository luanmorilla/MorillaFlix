// ============================================================
// /api/tmdb/trailer.js — SUPREMO 4.1 (Busca multilíngue + Fallback)
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
    const { id, type = "movie", language = "pt-BR" } = req.query;
    if (!id) return res.status(400).json({ error: "Parâmetro 'id' é obrigatório" });

    const cacheKey = `${type}_${id}_${language}`;
    if (cache.has(cacheKey))
      return res.status(200).json({ ...cache.get(cacheKey), cached: true });

    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const headers = TMDB_READ_TOKEN
      ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` }
      : {};

    const makeUrl = (lang) => {
      const base = `https://api.themoviedb.org/3/${type}/${id}/videos?language=${lang}`;
      return TMDB_API_KEY ? `${base}&api_key=${TMDB_API_KEY}` : base;
    };

    const langs = [language, "pt-BR", "en-US", "es-ES"];
    let videos = [];
    for (const lang of langs) {
      const resLang = await fetch(makeUrl(lang), { headers });
      const data = await resLang.json();
      if (data?.results?.length) {
        videos = data.results;
        break;
      }
    }

    const best = selectBestTrailer(videos);
    if (!best)
      return res.status(404).json({ error: "Nenhum trailer encontrado" });

    const result = {
      key: best.key,
      name: best.name,
      site: best.site,
      lang: best.iso_639_1 || "desconhecido",
      official: best.official || false,
    };

    cache.set(cacheKey, result);
    setTimeout(() => cache.delete(cacheKey), 10 * 60 * 1000);

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Erro Trailer:", err);
    return res.status(500).json({ error: "Falha ao buscar trailer" });
  }
}

function selectBestTrailer(videos = []) {
  const filters = [
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
    (v) => v.site === "YouTube" && v.type === "Trailer",
    (v) => v.site === "YouTube" && ["Teaser", "Clip"].includes(v.type),
    (v) => v.site === "YouTube",
  ];
  for (const fn of filters) {
    const found = videos.find(fn);
    if (found) return found;
  }
  return videos.find((v) => v.key);
}

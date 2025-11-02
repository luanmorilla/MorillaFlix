// ============================================================
// /api/tmdb/trailer.js — TMDb Trailer Inteligente PRO 2025
// Recursos: cache, multilíngue dinâmico, priorização oficial e fallback seguro.
// ============================================================

import fetch from "node-fetch";

const cache = new Map(); // Cache leve em memória (duração curta)

/**
 * Rota inteligente de trailers com fallback multilíngue
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { id, type = "movie", language = "pt-BR" } = req.query;

    if (!id) {
      return res.status(400).json({ error: "O parâmetro 'id' é obrigatório." });
    }
    if (!["movie", "tv"].includes(type)) {
      return res.status(400).json({ error: "Parâmetro 'type' deve ser 'movie' ou 'tv'." });
    }

    const cacheKey = `${type}_${id}_${language}`;
    if (cache.has(cacheKey)) {
      return res.status(200).json({ ...cache.get(cacheKey), cached: true });
    }

    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_READ_TOKEN && !TMDB_API_KEY) {
      return res.status(500).json({ error: "Chave TMDB ausente." });
    }

    // ====== Função para montar URL
    const makeUrl = (lang) => {
      const base = `https://api.themoviedb.org/3/${type}/${id}/videos?language=${encodeURIComponent(lang)}`;
      return TMDB_API_KEY ? `${base}&api_key=${encodeURIComponent(TMDB_API_KEY)}` : base;
    };

    const headers = TMDB_READ_TOKEN ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` } : {};

    // ====== Função de fetch robusta com timeout e retry
    async function fetchVideos(lang, retries = 2) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(makeUrl(lang), { headers, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.results || [];
      } catch (err) {
        clearTimeout(timeout);
        if (retries > 0) return fetchVideos(lang, retries - 1);
        return [];
      }
    }

    // ====== Estratégia multilíngue inteligente
    const langPriority = [language, "pt-BR", "pt-PT", "en-US", "es-ES", "fr-FR", "null"];
    let videos = [];

    for (const lang of langPriority) {
      try {
        videos = await fetchVideos(lang);
        if (videos.length > 0) break;
      } catch {
        continue;
      }
    }

    if (!videos.length) {
      return res.status(404).json({ error: "Nenhum vídeo encontrado para este título." });
    }

    // ====== Seleção de trailer ideal
    const best = selectBestTrailer(videos);

    if (!best) {
      return res.status(404).json({ error: "Trailer não encontrado ou inválido." });
    }

    const result = {
      key: best.key,
      name: best.name,
      type: best.type,
      site: best.site,
      lang: best.iso_639_1 || "desconhecido",
      official: best.official || false,
    };

    cache.set(cacheKey, result);
    setTimeout(() => cache.delete(cacheKey), 10 * 60 * 1000); // expira em 10 minutos

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Erro interno /api/tmdb/trailer:", err);
    return res.status(500).json({ error: "Falha interna na rota TMDb Trailer" });
  }
}

/**
 * 🎯 Seleciona o trailer mais relevante e oficial
 */
function selectBestTrailer(videos = []) {
  // Filtros por prioridade
  const filters = [
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official === true,
    (v) => v.site === "YouTube" && v.type === "Trailer",
    (v) => v.site === "YouTube" && ["Teaser", "Clip"].includes(v.type),
    (v) => v.site === "YouTube",
  ];

  for (const fn of filters) {
    const found = videos.find(fn);
    if (found) return found;
  }

  // fallback: qualquer trailer com vídeo key válida
  return videos.find((v) => v.key);
}

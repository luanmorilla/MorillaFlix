// api/tmdb/trailer.js — versão aprimorada (fallback multilíngue + filtros de qualidade)
import fetch from "node-fetch";

export default async function handler(req, res) {
  // ===== CORS básico
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

    const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;

    const makeUrl = (lang) =>
      `https://api.themoviedb.org/3/${type}/${id}/videos?language=${encodeURIComponent(lang)}${
        TMDB_API_KEY ? `&api_key=${encodeURIComponent(TMDB_API_KEY)}` : ""
      }`;

    const headers = TMDB_READ_TOKEN
      ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` }
      : {};

    // ===== Função auxiliar para buscar trailers
    async function getVideos(lang) {
      const url = makeUrl(lang);
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`TMDB ${r.status}`);
      const data = await r.json();
      return data.results || [];
    }

    // ===== 1️⃣ tenta PT-BR → 2️⃣ en-US → 3️⃣ sem idioma
    const langs = [language, "en-US", "null"];
    let videos = [];
    for (const lang of langs) {
      try {
        const resVideos = await getVideos(lang);
        if (resVideos.length) {
          videos = resVideos;
          break;
        }
      } catch (_) {
        continue;
      }
    }

    if (!videos.length) {
      return res.status(404).json({ error: "Nenhum vídeo encontrado." });
    }

    // ===== Prioriza trailers do YouTube com qualidade
    const trailer =
      videos.find((v) =>
        ["Trailer", "Teaser", "Clip"].includes(v.type) &&
        v.site === "YouTube" &&
        v.official === true
      ) ||
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
      videos.find((v) => v.site === "YouTube");

    if (trailer?.key) {
      return res.status(200).json({
        key: trailer.key,
        name: trailer.name,
        type: trailer.type,
        lang: trailer.iso_639_1,
      });
    }

    return res.status(404).json({ error: "Trailer não encontrado." });
  } catch (err) {
    console.error("❌ Erro na rota /api/tmdb/trailer:", err);
    return res
      .status(500)
      .json({ error: "Falha interna na rota TMDb Trailer" });
  }
}

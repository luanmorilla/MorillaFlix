// api/trailer.js
// GET /api/tmdb/trailer?id=12345&type=movie|tv
import fetch from "node-fetch";

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

    if (!id) return res.status(400).json({ error: "O parâmetro 'id' é obrigatório." });
    if (type !== "movie" && type !== "tv") {
      return res.status(400).json({ error: "O parâmetro 'type' deve ser 'movie' ou 'tv'." });
    }

    let url = `https://api.themoviedb.org/3/${type}/${id}/videos?language=${encodeURIComponent(language)}`;

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
    const videos = data.results || [];

    // 🧠 Escolhe trailer com prioridade
    const trailer = videos.find(v => v.type === "Trailer" && v.site === "YouTube")
      || videos.find(v => v.site === "YouTube");

    if (!trailer) return res.status(404).json({ error: "Nenhum trailer disponível." });

    return res.status(200).json({ key: trailer.key });

  } catch (err) {
    console.error("❌ Erro na rota /api/tmdb/trailer:", err);
    return res.status(500).json({ error: "Falha interna ao buscar trailer." });
  }
}

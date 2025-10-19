// api/tmdb/trailer.js
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
    if (!id) {
      return res.status(400).json({ error: "O parâmetro 'id' é obrigatório." });
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
      return res.status(500).json({ error: "Configure TMDB_READ_TOKEN ou TMDB_API_KEY." });
    }

    const tmdbRes = await fetch(url, { headers });
    if (!tmdbRes.ok) {
      const text = await tmdbRes.text();
      return res.status(tmdbRes.status).json({ error: "Erro ao consultar TMDb", body: text });
    }

    const data = await tmdbRes.json();
    const trailer = data.results?.find(
      v => v.type === "Trailer" && v.site === "YouTube"
    );

    if (trailer) {
      return res.status(200).json({ key: trailer.key });
    } else {
      return res.status(404).json({ error: "Trailer não encontrado" });
    }
  } catch (err) {
    console.error("❌ Erro na rota /api/tmdb/trailer:", err);
    return res.status(500).json({ error: "Falha interna na rota TMDb Trailer" });
  }
}

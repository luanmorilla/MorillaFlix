export default async function handler(req, res) {
    const { type, genreId } = req.query;
  
    if (!type || !genreId) return res.status(400).json({ error: "Parâmetros inválidos" });
  
    try {
      const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${process.env.TMDB_API_KEY}&with_genres=${genreId}&language=pt-BR`;
      const response = await fetch(url);
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      console.error("Erro na TMDb API:", err.message);
      res.status(500).json({ error: "Não foi possível buscar os filmes/séries" });
    }
  }
  
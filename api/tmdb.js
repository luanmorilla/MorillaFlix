export default async function handler(req, res) {
    const { type, genreId } = req.query;
  
    try {
      const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${process.env.TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&language=pt-BR&page=1`;
      const response = await fetch(url);
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar dados na TMDB" });
    }
  }
  
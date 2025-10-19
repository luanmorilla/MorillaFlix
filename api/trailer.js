export default async function handler(req, res) {
    const { id, type } = req.query;
  
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${process.env.TMDB_API_KEY}&language=pt-BR`
      );
      const data = await response.json();
  
      const trailer = data.results.find(
        (video) => video.type === "Trailer" && video.site === "YouTube"
      );
  
      if (trailer) {
        res.status(200).json({ key: trailer.key });
      } else {
        res.status(404).json({ error: "Trailer não encontrado" });
      }
    } catch (err) {
      console.error("Erro ao buscar trailer:", err);
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  }
  
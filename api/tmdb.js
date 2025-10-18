// /api/tmdb.js
const allowCors = (fn) => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*'); // 👈 libera acesso de qualquer origem
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    return await fn(req, res);
  };
  
  async function handler(req, res) {
    const { type, genreId } = req.query;
  
    if (!type || !genreId) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios não informados.' });
    }
  
    try {
      const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${process.env.TMDB_API_KEY}&with_genres=${genreId}&language=pt-BR`;
      const response = await fetch(url);
      const data = await response.json();
      res.status(200).json(data);
    } catch (err) {
      console.error('Erro TMDb:', err);
      res.status(500).json({ error: 'Erro ao buscar dados da TMDb.' });
    }
  }
  
  export default allowCors(handler);
  
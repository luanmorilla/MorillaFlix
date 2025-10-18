// =======================
// 🔗 Configuração de API fixa (sempre usa Vercel)
// =======================
const API_BASE = 'https://morilla-flix.vercel.app';

// =======================
// SELETORES
// =======================
const heroSection = document.querySelector('.hero');
const heroTitle = document.getElementById('hero-title');
const heroDescription = document.getElementById('hero-description');
const featuredBanner = document.getElementById('featured-banner');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const surpriseButton = document.getElementById('surprise-button');
const resultsContainer = document.getElementById('results');

// =======================
// GÊNEROS TMDB
// =======================
const movieGenres = { "Ação": 28, "Comédia": 35, "Drama": 18, "Terror": 27, "Romance": 10749, "Aventura": 12, "Ficção científica": 878, "Animação": 16 };
const tvGenres = { "Ação": 10759, "Comédia": 35, "Drama": 18, "Terror": 9648, "Romance": 10749, "Aventura": 10759, "Ficção científica": 10765, "Animação": 16 };

// =======================
// FUNÇÕES AUXILIARES
// =======================
function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const movieGenresNormalized = {};
for (const key in movieGenres) movieGenresNormalized[normalize(key)] = movieGenres[key];
const tvGenresNormalized = {};
for (const key in tvGenres) tvGenresNormalized[normalize(key)] = tvGenres[key];

function renderStars(vote) {
  const full = Math.floor(vote / 2);
  const half = vote % 2 >= 1 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + '½'.repeat(half) + '☆'.repeat(empty);
}

// =======================
// CRIAR CARD
// =======================
function createCard(item, type) {
  const card = document.createElement('div');
  card.classList.add('card');

  const title = item.title || item.name || "Sem título";
  const rating = item.vote_average || 0;
  const poster = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null;

  card.innerHTML = `
    <div class="poster">${poster ? `<img src="${poster}" alt="${title}">` : `<div class="no-image">Sem imagem</div>`}</div>
    <div class="card-info">
        <h3>${title}</h3>
        <p class="type">${type === 'movie' ? 'Filme' : 'Série'}</p>
        <p class="rating"><span class="stars">${renderStars(rating)}</span></p>
    </div>
  `;
  return card;
}

// =======================
// TMDB API
// =======================
async function fetchByGenre(type, genreId) {
  try {
    const res = await fetch(`${API_BASE}/api/tmdb?type=${type}&genreId=${genreId}`);
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("❌ Erro ao buscar na TMDb:", err);
    return [];
  }
}

// =======================
// OPENAI API
// =======================
async function enviarParaOpenAI(prompt) {
  try {
    const res = await fetch(`${API_BASE}/api/openai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.error) return "";
    return data.result || "";
  } catch (err) {
    console.error("❌ Erro ao conectar com a IA:", err);
    return "";
  }
}

// =======================
// BUSCA PRINCIPAL
// =======================
async function search() {
  const inputOriginal = searchInput.value.trim();
  if (!inputOriginal) return alert("Digite um gênero ou termo!");

  const input = normalize(inputOriginal);
  let type, genreId;

  if (movieGenresNormalized[input]) {
    type = 'movie'; genreId = movieGenresNormalized[input];
  } else if (tvGenresNormalized[input]) {
    type = 'tv'; genreId = tvGenresNormalized[input];
  } else {
    const prompt = `Dado o termo "${inputOriginal}", sugira um gênero de filme ou série em português.`;
    const sugestao = await enviarParaOpenAI(prompt);
    const sugestaoNormalized = normalize(sugestao);

    const possiveisGenres = [...Object.keys(movieGenresNormalized), ...Object.keys(tvGenresNormalized)];
    let encontrado = false;

    for (let g of possiveisGenres) {
      if (sugestaoNormalized.includes(normalize(g))) {
        if (movieGenresNormalized[normalize(g)]) { type = 'movie'; genreId = movieGenresNormalized[normalize(g)]; }
        else if (tvGenresNormalized[normalize(g)]) { type = 'tv'; genreId = tvGenresNormalized[normalize(g)]; }
        encontrado = true;
        break;
      }
    }

    if (!encontrado) {
      const allGenres = [...Object.keys(movieGenresNormalized)];
      const randomGenre = allGenres[Math.floor(Math.random() * allGenres.length)];
      type = 'movie';
      genreId = movieGenresNormalized[normalize(randomGenre)];
    }
  }

  resultsContainer.innerHTML = '';
  const results = await fetchByGenre(type, genreId);
  results.forEach(item => resultsContainer.appendChild(createCard(item, type)));

  resultsContainer.scrollLeft = 0;
}

// =======================
// SURPREENDA-ME
// =======================
async function surprise() {
  const genres = Object.keys(movieGenres);
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];
  searchInput.value = randomGenre;
  await search();
}

// =======================
// BANNER DESTAQUE
// =======================
async function loadFeatured() {
  try {
    const res = await fetch(`${API_BASE}/api/tmdb?type=movie&genreId=28`);
    const data = await res.json();
    const movies = data.results?.slice(0, 5) || [];

    if (movies.length > 0) {
      let current = 0;

      function updateHero(index) {
        if (heroSection && heroTitle && heroDescription) {
          heroTitle.textContent = movies[index].title;
          heroDescription.textContent = movies[index].overview || "Sem sinopse disponível";
          heroSection.style.backgroundImage =
            `linear-gradient(to bottom, rgba(0,0,0,0.6), #000), url(https://image.tmdb.org/t/p/original${movies[index].backdrop_path})`;
        }

        if (featuredBanner) {
          featuredBanner.innerHTML = `
            <img src="https://image.tmdb.org/t/p/original${movies[index].backdrop_path}" alt="${movies[index].title}">
            <div class="featured-info">
                <h2>${movies[index].title}</h2>
                <p>${movies[index].overview || "Sem sinopse disponível"}</p>
                <p>Nota: ${renderStars(movies[index].vote_average)}</p>
            </div>
          `;
        }
      }

      updateHero(current);
      setInterval(() => {
        current = (current + 1) % movies.length;
        updateHero(current);
      }, 6000);
    }
  } catch (error) {
    console.error("❌ Erro ao carregar banner:", error);
  }
}

// =======================
// EVENTOS
// =======================
searchButton.addEventListener('click', search);
searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') search(); });
surpriseButton.addEventListener('click', surprise);
loadFeatured();

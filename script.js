// 📌 Seletores principais
const featuredBanner = document.querySelector('.hero');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const surpriseButton = document.getElementById('surprise-button');
const resultsContainer = document.getElementById('results');
const heroTrailerBtn = document.getElementById('hero-trailer-btn');
const resultsTitle = document.querySelector('.results-section h3');
const generosContainer = document.getElementById('generos-container');

const AFFILIATE_LINK = "https://ev.braip.com/ref?pv=provwxxd&af=afi9em9m17";

// 🎥 Gêneros TMDb
const movieGenres = {
  "Ação": 28, "Aventura": 12, "Animação": 16, "Comédia": 35, "Crime": 80,
  "Documentário": 99, "Drama": 18, "Família": 10751, "Fantasia": 14,
  "História": 36, "Terror": 27, "Música": 10402, "Mistério": 9648,
  "Romance": 10749, "Ficção científica": 878, "Filme de TV": 10770,
  "Thriller": 53, "Guerra": 10752, "Faroeste": 37
};

const tvGenres = {
  "Ação": 10759, "Aventura": 10759, "Animação": 16, "Comédia": 35, "Crime": 80,
  "Documentário": 99, "Drama": 18, "Família": 10751, "Infantil": 10762,
  "Mistério": 9648, "Notícias": 10763, "Reality": 10764,
  "Ficção científica": 10765, "Talk Show": 10767, "Guerra e Política": 10768,
  "Faroeste": 37
};

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const movieGenresNormalized = {};
for (const key in movieGenres) movieGenresNormalized[normalize(key)] = movieGenres[key];

const tvGenresNormalized = {};
for (const key in tvGenres) tvGenresNormalized[normalize(key)] = tvGenres[key];

const generosValidos = Object.keys(movieGenresNormalized).concat(Object.keys(tvGenresNormalized));

// 🧠 CONTEXTO DE CONVERSA (IA)
let iaContexto = "";

// ⭐ Avaliação
function renderStars(vote) {
  const full = Math.floor(vote / 2);
  const half = vote % 2 >= 1 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + '½'.repeat(half) + '☆'.repeat(empty);
}

// 🕐 LOADING
function showLoading() {
  resultsContainer.innerHTML = `<div class="loading">🎬 Carregando recomendações...</div>`;
}
function hideLoading() {
  const loader = resultsContainer.querySelector('.loading');
  if (loader) loader.remove();
}

// 🃏 Cards
function createCard(item, type) {
  const card = document.createElement('div');
  card.classList.add('card');
  const title = item.title || item.name || "Sem título";
  let overview = item.overview || "Sem sinopse disponível";
  if (window.innerWidth <= 768 && overview.length > 120) overview = overview.slice(0, 120) + "...";
  const rating = item.vote_average || 0;
  const poster = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null;

  card.innerHTML = `
    <div class="poster">${poster ? `<img src="${poster}" alt="${title}">` : `<div class="no-image">Sem imagem</div>`}</div>
    <div class="card-info">
        <h3>${title}</h3>
        <p class="type">${type === 'movie' ? 'Filme' : 'Série'}</p>
        <p class="overview">${overview}</p>
        <button class="toggle-overview">Leia mais</button>
        <p class="rating">Nota: <span class="stars">${renderStars(rating)}</span></p>
        <a href="${AFFILIATE_LINK}" target="_blank" class="watch-now">🎬 Assistir agora</a>
        <button class="trailer-btn">🎥 Ver Trailer</button>
    </div>
  `;

  const toggleBtn = card.querySelector('.toggle-overview');
  const overviewP = card.querySelector('.overview');
  overviewP.style.maxHeight = "80px";
  overviewP.style.overflow = "hidden";
  toggleBtn.addEventListener('click', () => {
    if (toggleBtn.innerText === "Leia mais") {
      overviewP.style.maxHeight = "500px";
      toggleBtn.innerText = "Leia menos";
    } else {
      overviewP.style.maxHeight = "80px";
      toggleBtn.innerText = "Leia mais";
    }
  });

  const trailerBtn = card.querySelector('.trailer-btn');
  trailerBtn.addEventListener('click', () => fetchTrailer(item.id, type, overview));
  return card;
}

// 📡 TMDB
async function fetchByGenre(type, genreId) {
  try {
    if (!type || !genreId) { type = 'movie'; genreId = movieGenres["Ação"]; }
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const res = await fetch(`/api/tmdb?type=${type}&genreId=${genreId}&page=${randomPage}`);
    if (!res.ok) throw new Error("Erro ao buscar na TMDb");
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("❌ Erro ao buscar na TMDb:", err);
    return [];
  }
}

// 🧠 IA aprimorada
async function enviarParaOpenAI(prompt) {
  try {
    const fullPrompt = `
      Histórico: ${iaContexto}
      Nova mensagem: ${prompt}
      ---
      Responda com:
      - Um gênero exato (Ação, Comédia, Terror, etc)
      - Se for filme ou série
      - (Opcional) estilo adicional se houver.
      Resposta no formato: genero|tipo
    `;
    const res = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt })
    });
    const data = await res.json();
    if (data.error) return "";
    iaContexto += `\nUsuário: ${prompt}\nIA: ${data.result}`;
    return data.result || "";
  } catch (err) {
    console.error("❌ Erro IA:", err);
    return "";
  }
}

// 🔍 Busca com IA central
async function search(frase = null) {
  const texto = frase || searchInput.value.trim();
  if (!texto) return alert("Digite algo ou escolha um gênero!");
  showLoading();

  const interpretado = await enviarParaOpenAI(texto);
  let [genero, tipo] = interpretado.split("|").map(s => s.trim().toLowerCase());

  let type = tipo === "série" || tipo === "serie" ? "tv" : "movie";
  let generoId = movieGenresNormalized[normalize(genero)] || tvGenresNormalized[normalize(genero)];

  if (!generoId) { generoId = movieGenres["Ação"]; type = "movie"; }

  const results = await fetchByGenre(type, generoId);
  resultsContainer.innerHTML = '';
  results.forEach(item => resultsContainer.appendChild(createCard(item, type)));
  resultsTitle.textContent = `Resultados (${results.length})`;
}

// Gêneros
function renderGenerosList() {
  const generos = Object.keys(movieGenres);
  generos.forEach(gen => {
    const btn = document.createElement('button');
    btn.textContent = gen;
    btn.addEventListener('click', () => search(gen));
    generosContainer.appendChild(btn);
  });
}
renderGenerosList();

// Surpreenda-me
async function surprise() {
  const genres = Object.keys(movieGenres);
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];
  searchInput.value = randomGenre;
  await search(randomGenre);
}

// Banner
let featuredMovieId = null;
async function loadFeatured() {
  try {
    const genreIds = Object.values(movieGenres);
    const randomGenreId = genreIds[Math.floor(Math.random() * genreIds.length)];
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const res = await fetch(`/api/tmdb?type=movie&genreId=${randomGenreId}&page=${randomPage}`);
    const data = await res.json();
    const movies = data.results?.slice(0, 5) || [];
    let current = 0;
    function atualizarBanner(index) {
      const movie = movies[index];
      if (!movie) return;
      featuredMovieId = movie.id;
      featuredBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`;
      document.getElementById("hero-title").textContent = movie.title;
      document.getElementById("hero-description").textContent = movie.overview || "Sem sinopse disponível";
      document.getElementById("hero-watch-btn").href = AFFILIATE_LINK;
    }
    atualizarBanner(current);
    setInterval(() => {
      current = (current + 1) % movies.length;
      atualizarBanner(current);
    }, 5000);
  } catch (error) {
    console.error("❌ Erro ao carregar banner:", error);
  }
}
heroTrailerBtn.addEventListener('click', () => { if (featuredMovieId) fetchTrailer(featuredMovieId, "movie"); });
loadFeatured();

// Trailer
function openTrailer(videoKey) {
  const modal = document.getElementById("trailer-modal");
  const iframe = document.getElementById("trailer-video");
  iframe.src = `https://www.youtube.com/embed/${videoKey}?autoplay=1`;
  modal.style.display = "flex";
}
function closeTrailer() {
  const modal = document.getElementById("trailer-modal");
  const iframe = document.getElementById("trailer-video");
  iframe.src = "";
  modal.style.display = "none";
}
document.getElementById("close-modal").addEventListener("click", closeTrailer);
document.getElementById("trailer-modal").addEventListener("click", (e) => {
  if (e.target.id === "trailer-modal") closeTrailer();
});
async function fetchTrailer(id, type, overviewText) {
  try {
    const res = await fetch(`/api/tmdb/trailer?id=${id}&type=${type}`);
    const data = await res.json();
    if (data.key) openTrailer(data.key);
    else speakText(overviewText || "Sinopse não disponível.");
  } catch (err) {
    console.error("❌ Erro trailer:", err);
    speakText(overviewText || "Não foi possível carregar o trailer.");
  }
}

// Narração
function speakText(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.rate = 1;
  speechSynthesis.speak(utter);
}

// Humor
const moodButtons = document.querySelectorAll('.mood-buttons button');
moodButtons.forEach(button => {
  button.addEventListener('click', async () => {
    const mood = button.dataset.mood;
    await search(`baseado no meu humor ${mood}`);
  });
});

// Notificações
function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.classList.add('show');
  setTimeout(() => notification.classList.remove('show'), 4000);
}

// Navegação suave
document.querySelectorAll('.navbar a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const targetId = link.getAttribute('href').replace('#', '');
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      window.scrollTo({ top: targetSection.offsetTop - 60, behavior: 'smooth' });
    }
  });
});
window.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('section[id]');
  let scrollY = window.scrollY + 70;
  sections.forEach(sec => {
    const link = document.querySelector(`.navbar a[href="#${sec.id}"]`);
    if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
      document.querySelectorAll('.navbar a').forEach(a => a.classList.remove('active'));
      if (link) link.classList.add('active');
    }
  });
});

// Eventos principais
searchButton.addEventListener('click', () => search());
searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') search(); });
surpriseButton.addEventListener('click', surprise);

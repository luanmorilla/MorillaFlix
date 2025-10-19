// 📌 Seletores principais
const featuredBanner = document.querySelector('.hero');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const surpriseButton = document.getElementById('surprise-button');
const resultsContainer = document.getElementById('results');
const heroTrailerBtn = document.getElementById('hero-trailer-btn');
const AFFILIATE_LINK = "https://ev.braip.com/ref?pv=provwxxd&af=afi9em9m17";

// 🎥 Gêneros TMDb — Filmes e Séries
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

// 🧠 Normalização
function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const movieGenresNormalized = {};
for (const key in movieGenres) movieGenresNormalized[normalize(key)] = movieGenres[key];

const tvGenresNormalized = {};
for (const key in tvGenres) tvGenresNormalized[normalize(key)] = tvGenres[key];

const generosValidos = Object.keys(movieGenresNormalized).concat(Object.keys(tvGenresNormalized));

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

// 🃏 Cards de filme
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

// 📡 Busca TMDb
async function fetchByGenre(type, genreId) {
  try {
    if (!type || !genreId) {
      type = 'movie';
      genreId = movieGenres["Ação"];
    }
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

// 🧠 IA - Sugestão de gênero
async function enviarParaOpenAI(prompt) {
  try {
    const res = await fetch('/api/openai', {
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

// 🔍 Busca normal
async function search() {
  const inputOriginal = searchInput.value.trim();
  if (!inputOriginal) return alert("Digite um gênero ou termo!");

  showLoading();
  const input = normalize(inputOriginal);
  let type, genreId;

  if (movieGenresNormalized[input]) {
    type = 'movie'; genreId = movieGenresNormalized[input];
  } else if (tvGenresNormalized[input]) {
    type = 'tv'; genreId = tvGenresNormalized[input];
  } else {
    const prompt = `
      Você é um assistente de recomendação de filmes. 
      Dado o termo "${inputOriginal}", responda com APENAS UM dos gêneros de filme ou série abaixo:
      ${Object.keys(movieGenres).join(", ")}, ${Object.keys(tvGenres).join(", ")}.
    `;
    let sugestao = await enviarParaOpenAI(prompt);
    let sugestaoNormalized = normalize(sugestao);
    if (!generosValidos.includes(sugestaoNormalized)) sugestaoNormalized = "ação";

    if (movieGenresNormalized[sugestaoNormalized]) {
      type = 'movie'; genreId = movieGenresNormalized[sugestaoNormalized];
    } else if (tvGenresNormalized[sugestaoNormalized]) {
      type = 'tv'; genreId = tvGenresNormalized[sugestaoNormalized];
    }
  }

  const results = await fetchByGenre(type, genreId);
  resultsContainer.innerHTML = '';
  results.forEach(item => resultsContainer.appendChild(createCard(item, type)));
}

// 🎲 Surpreenda-me
async function surprise() {
  const genres = Object.keys(movieGenres);
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];
  searchInput.value = randomGenre;
  await search();
}

// 🖼️ Banner dinâmico
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

heroTrailerBtn.addEventListener('click', () => {
  if (featuredMovieId) fetchTrailer(featuredMovieId, "movie");
});

loadFeatured();

// ======== MODAL DO TRAILER ========
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

// ======== FETCH TRAILER + NARRAÇÃO ========
async function fetchTrailer(id, type, overviewText) {
  try {
    const res = await fetch(`/api/tmdb/trailer?id=${id}&type=${type}`);
    const data = await res.json();

    if (data.key) {
      openTrailer(data.key);
    } else {
      speakText(overviewText || "Sinopse não disponível.");
    }
  } catch (err) {
    console.error("❌ Erro ao buscar trailer:", err);
    speakText(overviewText || "Não foi possível carregar o trailer.");
  }
}

// 🗣️ Narração com voz do navegador
function speakText(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.rate = 1;
  speechSynthesis.speak(utter);
}

// ======== IA CURADOR ========
const moodButtons = document.querySelectorAll('.mood-buttons button');

const moodPrompts = {
  animado: "Usuário está animado, recomende filmes de ação, aventura ou comédia.",
  triste: "Usuário está triste, recomende filmes de comédia leve ou animações.",
  assustado: "Usuário quer sustos, recomende filmes de terror e suspense.",
  romantico: "Usuário está romântico, recomende filmes de romance.",
  entediado: "Usuário está entediado, recomende filmes populares e diferentes."
};

moodButtons.forEach(button => {
  button.addEventListener('click', async () => {
    showLoading();
    const mood = button.dataset.mood;
    const prompt = moodPrompts[mood];

    const genreSuggestion = await enviarParaOpenAI(`
      Você é um assistente de recomendação de filmes.
      Com base no humor "${mood}", sugira APENAS UM gênero exato da lista:
      ${Object.keys(movieGenres).join(", ")}, ${Object.keys(tvGenres).join(", ")}.
    `);

    const normalizedGenre = normalize(genreSuggestion);
    let type, genreId;

    if (movieGenresNormalized[normalizedGenre]) {
      type = 'movie';
      genreId = movieGenresNormalized[normalizedGenre];
    } else if (tvGenresNormalized[normalizedGenre]) {
      type = 'tv';
      genreId = tvGenresNormalized[normalizedGenre];
    } else {
      type = 'movie';
      genreId = movieGenres["Ação"];
    }

    const results = await fetchByGenre(type, genreId);
    resultsContainer.innerHTML = '';
    results.forEach(item => resultsContainer.appendChild(createCard(item, type)));
  });
});

// Eventos principais
searchButton.addEventListener('click', search);
searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') search(); });
surpriseButton.addEventListener('click', surprise);
// 🛎️ Notificações amigáveis
function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000);
}
// Rolagem suave para seções da navbar
document.querySelectorAll('.navbar a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const targetId = link.getAttribute('href').replace('#', '');
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      window.scrollTo({
        top: targetSection.offsetTop - 60, // 👈 compensa o header fixo
        behavior: 'smooth'
      });
    }
  });
});
// Destacar botão ativo
window.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('section[id]');
  let scrollY = window.scrollY + 70; // compensar header fixo
  sections.forEach(sec => {
    const link = document.querySelector(`.navbar a[href="#${sec.id}"]`);
    if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
      document.querySelectorAll('.navbar a').forEach(a => a.classList.remove('active'));
      if (link) link.classList.add('active');
    }
  });
});

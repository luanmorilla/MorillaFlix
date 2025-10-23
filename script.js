/* =========================================================================
   MORILLALFLIX — script.js (versão TURBO IA + multi-gêneros + avaliações)
   ========================================================================= */

// ===== Seletores principais (DOM)
const featuredBanner   = document.querySelector('.hero');
const heroTrailerBtn   = document.getElementById('hero-trailer-btn');
const resultsTitle     = document.querySelector('.results-section h3');
const resultsContainer = document.getElementById('results');
const searchInput      = document.getElementById('search-input');
const searchButton     = document.getElementById('search-button');
const surpriseButton   = document.getElementById('surprise-button');
const generosSection   = document.querySelector('.generos-section');
const sobreSection     = document.querySelector('.sobre-section');
const generosContainer = document.getElementById('generos-container');
const moodButtonsWrap  = document.querySelector('.mood-buttons');

const heroTitle        = document.getElementById('hero-title');
const heroDesc         = document.getElementById('hero-description');
const heroWatchBtn     = document.getElementById('hero-watch-btn');

const AFFILIATE_LINK   = "https://ev.braip.com/ref?pv=provwxxd&af=afi9em9m17";

/* =========================================================================
   GÊNEROS COMPLETOS DO TMDB
   ========================================================================= */
const movieGenres = {
  "Ação": 28,"Aventura": 12,"Animação": 16,"Comédia": 35,"Crime": 80,
  "Documentário": 99,"Drama": 18,"Família": 10751,"Fantasia": 14,
  "História": 36,"Terror": 27,"Música": 10402,"Mistério": 9648,
  "Romance": 10749,"Ficção científica": 878,"Filme de TV": 10770,
  "Thriller": 53,"Guerra": 10752,"Faroeste": 37
};
const tvGenres = {
  "Ação e Aventura": 10759,"Animação": 16,"Comédia": 35,"Crime": 80,
  "Documentário": 99,"Drama": 18,"Família": 10751,"Kids": 10762,
  "Mistério": 9648,"Notícias": 10763,"Reality": 10764,
  "Ficção científica e Fantasia": 10765,"Talk Show": 10767,
  "Guerra e Política": 10768,"Faroeste": 37
};

const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const movieGenresNorm = Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
const tvGenresNorm    = Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));

/* =========================================================================
   HUMOR MAP
   ========================================================================= */
const MOOD_MAP = {
  "animado":      { genero: "Ação",            type: "movie" },
  "triste":       { genero: "Comédia",         type: "movie" },
  "assustado":    { genero: "Terror",          type: "movie" },
  "romântico":    { genero: "Romance",         type: "movie" },
  "romantico":    { genero: "Romance",         type: "movie" },
  "entediado":    { genero: "Aventura",        type: "movie" },
  "nervoso":      { genero: "Thriller",        type: "movie" },
  "pensativo":    { genero: "Drama",           type: "movie" },
  "curioso":      { genero: "Mistério",        type: "movie" },
  "futurista":    { genero: "Ficção científica", type: "movie" },
  "família":      { genero: "Família",         type: "movie" },
  "familia":      { genero: "Família",         type: "movie" },
};

/* =========================================================================
   IA MULTI-GÊNEROS
   ========================================================================= */
async function askAI(prompt){
  try{
    const context = `
Você é um assistente que interpreta frases de usuários em português e responde no formato:
Gênero1,Gênero2,...|Filme ou Série
- Se tiver vários gêneros, separe por vírgula.
- Se não tiver tipo, usar "Filme".
- Não explique nada. Só retorne no formato correto.
Ex: "Quero ação e comédia" -> Ação,Comédia|Filme
    "Série de drama e romance" -> Drama,Romance|Série
    "Me indica terror" -> Terror|Filme
`;
    const res = await fetchJSON('/api/openai', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt: context + "\nUsuário: " + prompt})
    });

    let raw = (res && res.result) ? String(res.result).trim() : "";
    raw = raw.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N},|]/gu, '');
    return raw || "";
  }catch(e){
    console.warn('OpenAI fallback usado:', e);
    return "";
  }
}

/* =========================================================================
   UTILITÁRIOS
   ========================================================================= */
async function fetchJSON(url, options = {}, { timeoutMs = 12000, retries = 1 } = {}){
  for(let attempt=0; attempt<=retries; attempt++){
    const controller = new AbortController();
    const t = setTimeout(()=>controller.abort(), timeoutMs);
    try{
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }catch(err){
      clearTimeout(t);
      if(attempt === retries){
        console.error(`fetchJSON falhou ${url}:`, err);
        throw err;
      }
      await new Promise(r=>setTimeout(r, 400*(attempt+1)));
    }
  }
}

function renderStars(vote=0){
  const full = Math.floor(vote/2);
  const half = vote%2>=1 ? 1 : 0;
  const empty = 5-full-half;
  return '★'.repeat(full)+'½'.repeat(half)+'☆'.repeat(empty);
}

function showLoading(){
  resultsContainer.innerHTML = `
    <div class="loading-container" role="status" aria-live="polite">
      <div class="spinner"></div>
      <span class="loading-text">Carregando recomendações…</span>
    </div>
  `;
}

let heroLoaderEl = null;
function showHeroLoading(){
  if(heroLoaderEl) return;
  heroLoaderEl = document.createElement('div');
  heroLoaderEl.className = 'hero-loading';
  heroLoaderEl.innerHTML = `
    <div class="spinner"></div>
    <span class="loading-text">Carregando destaque…</span>
  `;
  featuredBanner.appendChild(heroLoaderEl);
}
function clearHeroLoading(){
  if(heroLoaderEl){
    heroLoaderEl.remove();
    heroLoaderEl = null;
  }
}

/* =========================================================================
   CARDS
   ========================================================================= */
function createCard(item,type){
  const title   = item.title || item.name || "Sem título";
  const rating  = item.vote_average || 0;
  const poster  = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
  let overview  = item.overview || "Sem sinopse disponível";

  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="poster">${poster ? `<img src="${poster}" alt="${title}">` : ''}</div>
    <div class="card-info">
      <h3>${title}</h3>
      <p class="type">${type==='movie' ? 'Filme' : 'Série'}</p>
      <div class="overview-box">
        <p class="overview">${overview}</p>
        <button class="toggle-overview" type="button">Leia mais</button>
      </div>
      <p class="meta">Nota: <span class="stars">${renderStars(rating)}</span></p>
      <div class="actions">
        <a class="watch-now" href="${AFFILIATE_LINK}" target="_blank" rel="noopener">Assistir agora</a>
        <button class="trailer-btn" type="button">Ver Trailer</button>
      </div>
    </div>
  `;

  // Botão Leia mais
  const btn = el.querySelector('.toggle-overview');
  const txt = el.querySelector('.overview');
  let expanded = false;
  btn.addEventListener('click',()=>{
    expanded = !expanded;
    txt.style.maxHeight = expanded ? 'none' : '60px';
    btn.textContent = expanded ? 'Leia menos' : 'Leia mais';
  });

  el.querySelector('.trailer-btn').addEventListener('click',()=>fetchTrailer(item.id,type,overview));
  return el;
}

/* =========================================================================
   BUSCA
   ========================================================================= */
async function fetchByGenre(type,genreId){
  try{
    const page = Math.floor(Math.random()*10)+1;
    const data = await fetchJSON(`/api/tmdb?type=${type}&genreId=${genreId}&page=${page}`, {}, {retries:1});
    return data.results || [];
  }catch(e){
    console.error('fetchByGenre', e);
    return [];
  }
}

async function search(text=null){
  const input = (text ?? searchInput.value).trim();
  if(!input) return;
  showLoading();

  const ai = await askAI(input);
  let [generosRaw,tipoRaw] = ai.split('|').map(s=> (s||'').trim());
  let generos = (generosRaw || "").split(',').map(g=>g.trim()).filter(Boolean);

  if(!generos.length){
    const norm = normalize(input);
    const keys = Object.keys(movieGenresNorm);
    const found = keys.find(k => norm.includes(normalize(k)));
    generos = [found || "ação"];
  }

  let type = (tipoRaw && tipoRaw.toLowerCase().includes('série')) ? 'tv' :
             (tipoRaw && tipoRaw.toLowerCase().includes('serie')) ? 'tv' : 'movie';

  let allResults = [];
  for(const genero of generos){
    const genreId = movieGenresNorm[normalize(genero)] || tvGenresNorm[normalize(genero)];
    if(!genreId) continue;
    const items = await fetchByGenre(type,genreId);
    allResults.push(...items);
  }

  const unique = [];
  const seen = new Set();
  for(const item of allResults){
    if(!seen.has(item.id)){
      seen.add(item.id);
      unique.push(item);
    }
  }

  resultsContainer.innerHTML = "";
  unique.forEach(it => resultsContainer.appendChild(createCard(it,type)));

  resultsContainer.style.opacity = "0";
  setTimeout(() => {
    resultsContainer.style.opacity = "1";
    resultsContainer.style.transition = "opacity 0.4s ease";
  }, 50);

  resultsTitle.textContent = `Resultados (${unique.length})`;
  window.scrollTo({ top: resultsContainer.offsetTop - 70, behavior: 'smooth' });
}

function renderGeneros(){
  if(!generosContainer) return;
  generosContainer.innerHTML = "";
  Object.keys(movieGenres).forEach(gen=>{
    const b=document.createElement('button');
    b.textContent = gen;
    b.addEventListener('click',()=>search(gen));
    generosContainer.appendChild(b);
  });
}

/* =========================================================================
   BANNER — Destaques
   ========================================================================= */
let featuredIndex = 0;
let featuredMovies = [];
let featuredMovieId = null;
let bannerTimer = null;

async function loadFeatured(){
  try{
    showHeroLoading();
    const genreIds = Object.values(movieGenres);
    const picks = [];
    for(let i=0; i<6; i++){
      const gid = genreIds[Math.floor(Math.random()*genreIds.length)];
      const pg  = Math.floor(Math.random()*6)+1;
      try{
        const data = await fetchJSON(`/api/tmdb?type=movie&genreId=${gid}&page=${pg}`, {}, {retries:1});
        const withBackdrop = (data.results || []).filter(x=>x && x.backdrop_path);
        picks.push(...withBackdrop);
        if(picks.length >= 12) break;
      }catch(err){
        console.warn('Tentativa de banner falhou (continua):', err);
      }
    }
    featuredMovies = shuffleArray(picks).slice(0, 12);
    if(featuredMovies.length === 0){
      clearHeroLoading();
      featuredBanner.style.backgroundImage = 'none';
      heroTitle.textContent = "Sem destaques no momento";
      heroDesc.textContent  = "Tente novamente mais tarde ou faça uma busca.";
      heroWatchBtn.href     = AFFILIATE_LINK;
      return;
    }
    showFeaturedBanner();
    clearHeroLoading();
    if(bannerTimer) clearInterval(bannerTimer);
    bannerTimer = setInterval(()=>{
      featuredIndex = (featuredIndex + 1) % featuredMovies.length;
      showFeaturedBanner();
    }, 10000);
  }catch(e){
    console.error('loadFeatured fatal:', e);
    clearHeroLoading();
  }
}

function showFeaturedBanner(){
  const movie = featuredMovies[featuredIndex];
  if(!movie) return;
  featuredMovieId = movie.id;
  featuredBanner.classList.remove('fade');
  void featuredBanner.offsetWidth;
  featuredBanner.classList.add('fade');
  featuredBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`;
  heroTitle.textContent = movie.title || "Destaque";
  heroDesc.textContent  = movie.overview || "Sem sinopse disponível";
  heroWatchBtn.href     = AFFILIATE_LINK;
}
function shuffleArray(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
heroTrailerBtn.addEventListener('click',()=>{
  if(featuredMovieId) fetchTrailer(featuredMovieId,'movie',heroDesc.textContent);
});

/* =========================================================================
   TRAILER (Modal)
   ========================================================================= */
function openTrailer(key){
  const modal = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-video');
  iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1`;
  modal.style.display='flex';
  modal.setAttribute('aria-hidden','false');
}
function closeTrailer(){
  const modal = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-video');
  iframe.src = '';
  modal.style.display='none';
  modal.setAttribute('aria-hidden','true');
}
document.getElementById('close-modal').addEventListener('click',closeTrailer);
document.getElementById('trailer-modal').addEventListener('click',e=>{
  if(e.target.id==='trailer-modal') closeTrailer();
});

async function fetchTrailer(id,type,overview){
  try{
    let data = await tryTrailer(id,type,'pt-BR');
    if(!(data && data.key)){
      data = await tryTrailer(id,type,'en-US');
    }
    if(data && data.key){
      openTrailer(data.key);
    }else{
      speak(overview || "Sinopse não disponível.");
    }
  }catch(e){
    console.error('fetchTrailer', e);
    speak(overview || "Não foi possível carregar o trailer.");
  }
}
async function tryTrailer(id,type,lang){
  try{
    return await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=${encodeURIComponent(lang)}`, {}, {retries:0});
  }catch(_){ return null; }
}
function speak(txt){
  const u = new SpeechSynthesisUtterance(txt);
  u.lang='pt-BR'; u.rate=1;
  speechSynthesis.speak(u);
}

/* =========================================================================
   NAVEGAÇÃO
   ========================================================================= */
document.querySelectorAll('.navbar a').forEach(a=>{
  a.addEventListener('click',e=>{
    const target = a.dataset.nav;
    document.querySelectorAll('.navbar a').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    generosSection.classList.remove('active');
    sobreSection.classList.remove('active');
    if(target==='generos'){
      e.preventDefault();
      renderGeneros();
      generosSection.classList.add('active');
      window.scrollTo({top:generosSection.offsetTop-70,behavior:'smooth'});
    }else if(target==='sobre'){
      e.preventDefault();
      sobreSection.classList.add('active');
      window.scrollTo({top:sobreSection.offsetTop-70,behavior:'smooth'});
    }
  });
});

/* =========================================================================
   HUMOR
   ========================================================================= */
if(moodButtonsWrap){
  moodButtonsWrap.querySelectorAll('button[data-mood]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      moodButtonsWrap.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const mood = (btn.dataset.mood || '').toLowerCase();
      const map  = MOOD_MAP[mood];
      if(map){
        const prompt = `${map.genero}|${map.type==='tv'?'série':'filme'}`;
        search(prompt);
      }else{
        search(mood || 'Ação');
      }
    });
  });
});

/* =========================================================================
   SISTEMA DE AVALIAÇÕES ⭐
   ========================================================================= */
const starContainer = document.getElementById('star-rating');
if (starContainer) {
  const stars = starContainer.querySelectorAll('span');
  const comentarioInput = document.getElementById('comentario');
  const enviarAvaliacaoBtn = document.getElementById('enviar-avaliacao');
  const avaliacoesLista = document.getElementById('avaliacoes-lista');

  let avaliacaoSelecionada = 0;

  stars.forEach(star => {
    star.addEventListener('click', () => {
      avaliacaoSelecionada = parseInt(star.getAttribute('data-value'));
      stars.forEach(s => s.classList.remove('selected'));
      for (let i = 0; i < avaliacaoSelecionada; i++) {
        stars[i].classList.add('selected');
      }
    });
  });

  enviarAvaliacaoBtn.addEventListener('click', () => {
    const comentario = comentarioInput.value.trim();
    if (avaliacaoSelecionada === 0) {
      alert('Por favor, selecione uma quantidade de estrelas.');
      return;
    }
    if (comentario === '') {
      alert('Por favor, escreva um comentário.');
      return;
    }

    const novaAvaliacao = {
      estrelas: avaliacaoSelecionada,
      comentario: comentario,
      data: new Date().toLocaleString('pt-BR')
    };

    let avaliacoes = JSON.parse(localStorage.getItem('avaliacoesMorillaFlix')) || [];
    avaliacoes.unshift(novaAvaliacao);
    localStorage.setItem('avaliacoesMorillaFlix', JSON.stringify(avaliacoes));

    comentarioInput.value = '';
    avaliacaoSelecionada = 0;
    stars.forEach(s => s.classList.remove('selected'));
    exibirAvaliacoes();
  });

  function exibirAvaliacoes() {
    avaliacoesLista.innerHTML = '';
    const avaliacoes = JSON.parse(localStorage.getItem('avaliacoesMorillaFlix')) || [];

    if (avaliacoes.length === 0) {
      avaliacoesLista.innerHTML = '<p style="text-align:center; color:#aaa;">Nenhuma avaliação ainda. Seja o primeiro! ⭐</p>';
      return;
    }

    avaliacoes.forEach(avaliacao => {
      const item = document.createElement('div');
      item.classList.add('avaliacao-item');

      const estrelas = '★'.repeat(avaliacao.estrelas) + '☆'.repeat(5 - avaliacao.estrelas);

      item.innerHTML = `
        <div class="estrelas">${estrelas}</div>
        <p>${avaliacao.comentario}</p>
        <small style="color:#777; font-size:0.8rem;">${avaliacao.data}</small>
      `;

      avaliacoesLista.appendChild(item);
    });
  }

  window.addEventListener('DOMContentLoaded', exibirAvaliacoes);
}

/* =========================================================================
   EVENTOS
   ========================================================================= */
searchButton.addEventListener('click',()=>search());
searchInput.addEventListener('keyup',e=>{ if(e.key==='Enter') search(); });
surpriseButton.addEventListener('click',()=>{
  const arr = Object.keys(movieGenres);
  const gen = arr[Math.floor(Math.random()*arr.length)];
  search(gen);
});

/* =========================================================================
   BOOT
   ========================================================================= */
renderGeneros();
resultsTitle.textContent = 'Top do momento';
loadFeatured();

/* =========================================================================
   MORILLALFLIX — script.js (versão PRO)
   - Destaques (banner) com carrossel automático e fade
   - “Receba sugestões pelo seu humor” funcionando
   - Busca com IA + fallback
   - Trailers robustos com fallback
   - Utilitários de rede (timeout + retry)
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

// ===== Gêneros TMDb
const movieGenres = {
  "Ação": 28,"Aventura": 12,"Animação": 16,"Comédia": 35,"Crime": 80,
  "Documentário": 99,"Drama": 18,"Família": 10751,"Fantasia": 14,
  "História": 36,"Terror": 27,"Música": 10402,"Mistério": 9648,
  "Romance": 10749,"Ficção científica": 878,"Filme de TV": 10770,
  "Thriller": 53,"Guerra": 10752,"Faroeste": 37
};
const tvGenres = {
  "Ação": 10759,"Aventura": 10759,"Animação": 16,"Comédia": 35,"Crime": 80,
  "Documentário": 99,"Drama": 18,"Família": 10751,"Infantil": 10762,"Mistério": 9648,
  "Notícias": 10763,"Reality": 10764,"Ficção científica": 10765,"Talk Show": 10767,
  "Guerra e Política": 10768,"Faroeste": 37
};

// ===== Mapas auxiliares
const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const movieGenresNorm = Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
const tvGenresNorm    = Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));

// Mapear humores → gênero + tipo (ajuste fino do “feeling”)
const MOOD_MAP = {
  "animado":      { genero: "Ação",            type: "movie" },
  "triste":       { genero: "Comédia",         type: "movie" },
  "assustado":    { genero: "Terror",          type: "movie" },
  "romântico":    { genero: "Romance",         type: "movie" },
  "romantico":    { genero: "Romance",         type: "movie" }, // sem acento
  "entediado":    { genero: "Aventura",        type: "movie" },
  // extras
  "nervoso":      { genero: "Thriller",        type: "movie" },
  "pensativo":    { genero: "Drama",           type: "movie" },
  "curioso":      { genero: "Mistério",        type: "movie" },
  "futurista":    { genero: "Ficção científica", type: "movie" },
  "família":      { genero: "Família",         type: "movie" },
  "familia":      { genero: "Família",         type: "movie" },
};

// ===== IA
let iaContext = "";
async function askAI(prompt){
  try{
    const full = `Histórico:\n${iaContext}\nUsuário: ${prompt}\nResponda apenas "genero|tipo" (ex: Ação|filme).`;
    const res = await fetchJSON('/api/openai', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:full})
    });
    const answer = (res && res.result) ? String(res.result) : "";
    iaContext += `\nIA: ${answer}`;
    return answer;
  }catch(e){
    console.warn('OpenAI fallback usado:', e);
    return "";
  }
}

// ===== Utilitários de rede (timeout + retry)
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

// ===== Estrelas
function renderStars(vote=0){
  const full = Math.floor(vote/2);
  const half = vote%2>=1 ? 1 : 0;
  const empty = 5-full-half;
  return '★'.repeat(full)+'½'.repeat(half)+'☆'.repeat(empty);
}

// ===== Loading nos resultados
function showLoading(){
  resultsContainer.innerHTML = `
    <div class="loading-container" role="status" aria-live="polite">
      <div class="spinner"></div>
      <span class="loading-text">Carregando recomendações…</span>
    </div>
  `;
}

// ===== Loader do banner (NÃO substituir o conteúdo do hero!)
let heroLoaderEl = null;
function showHeroLoading(){
  if(heroLoaderEl) return;
  heroLoaderEl = document.createElement('div');
  heroLoaderEl.className = 'hero-loading';
  heroLoaderEl.innerHTML = `
    <div class="spinner"></div>
    <span class="loading-text">Carregando destaque…</span>
  `;
  heroLoaderEl.setAttribute('aria-live','polite');
  featuredBanner.appendChild(heroLoaderEl); // 👈 anexa, não apaga o hero-content
}
function clearHeroLoading(){
  if(heroLoaderEl){
    heroLoaderEl.remove();
    heroLoaderEl = null;
  }
}

// ===== Cards
function createCard(item,type){
  const title   = item.title || item.name || "Sem título";
  const rating  = item.vote_average || 0;
  const poster  = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
  let overview  = item.overview || "Sem sinopse disponível";
  if (overview.length>220) overview = overview.slice(0,220)+'…';

  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="poster">${poster ? `<img src="${poster}" alt="${title}">` : ''}</div>
    <div class="card-info">
      <h3>${title}</h3>
      <p class="type">${type==='movie' ? 'Filme' : 'Série'}</p>
      <p class="overview">${overview}</p>
      <button class="toggle-overview" type="button" aria-label="Expandir sinopse">Leia mais</button>
      <p class="meta">Nota: <span class="stars">${renderStars(rating)}</span></p>
      <div class="actions">
        <a class="watch-now" href="${AFFILIATE_LINK}" target="_blank" rel="noopener" aria-label="Assistir agora">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h2l2 4h8l2-4h2l2 4v12H2V8l2-4zm2 6v8h12v-8H6z"/></svg>
          Assistir agora
        </a>
        <button class="trailer-btn" type="button" aria-label="Ver trailer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17 10.5V7c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-3.5l4 4v-11l-4 4z"/></svg>
          Ver Trailer
        </button>
      </div>
    </div>
  `;

  // Expand/contrair sinopse
  const btn = el.querySelector('.toggle-overview');
  const txt = el.querySelector('.overview');
  let expanded = false;
  btn.addEventListener('click',()=>{
    expanded = !expanded;
    txt.style.maxHeight = expanded ? 'none' : '84px';
    btn.textContent = expanded ? 'Leia menos' : 'Leia mais';
  });

  // Trailer
  el.querySelector('.trailer-btn').addEventListener('click',()=>fetchTrailer(item.id,type,overview));
  return el;
}

// ===== TMDb (busca por gênero para resultados)
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

// ===== Busca principal (IA + fallback)
async function search(text=null){
  const input = (text ?? searchInput.value).trim();
  if(!input) return;
  showLoading();

  // Delega pra IA interpretar (mas temos fallback)
  const ai = await askAI(input);
  let [generoRaw,tipoRaw] = ai.split('|').map(s=> (s||'').trim().toLowerCase());

  // Fallback se IA não ajudar
  if(!generoRaw){
    // tenta descobrir por palavra-chave do input
    const norm = normalize(input);
    const keys = Object.keys(movieGenresNorm);
    generoRaw = keys.find(k => norm.includes(normalize(k))) || "ação";
  }
  let type = (tipoRaw==='série'||tipoRaw==='serie'||normalize(input).includes('série')||normalize(input).includes('serie')) ? 'tv' : 'movie';

  let genreId = movieGenresNorm[normalize(generoRaw)] || tvGenresNorm[normalize(generoRaw)];
  if(!genreId){
    type = 'movie';
    genreId = movieGenres["Ação"];
  }

  const items = await fetchByGenre(type,genreId);
  resultsContainer.innerHTML = "";
  items.forEach(it => resultsContainer.appendChild(createCard(it,type)));

  // fade-in nos resultados
  resultsContainer.style.opacity = "0";
  setTimeout(() => {
    resultsContainer.style.opacity = "1";
    resultsContainer.style.transition = "opacity 0.4s ease";
  }, 50);

  resultsTitle.textContent = `Resultados (${items.length})`;
  // rolar até resultados
  window.scrollTo({ top: resultsContainer.offsetTop - 70, behavior: 'smooth' });
}

// ===== Renderização da lista de gêneros
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

/* ========================================================================
   BANNER (DESTAQUES) — Carrossel robusto com fade e fallback
   - Coleta uma lista de filmes com backdrop a partir de várias fontes:
     * múltiplos gêneros aleatórios (páginas aleatórias)  -> mais resiliente
   - Não depende de year/sort_by do backend (evita travar)
   ======================================================================== */
let featuredIndex = 0;
let featuredMovies = [];
let featuredMovieId = null;
let bannerTimer = null;

async function loadFeatured(){
  try{
    showHeroLoading();

    // Tenta montar uma lista com backdrops a partir de vários gêneros/páginas
    const genreIds = Object.values(movieGenres);
    const picks = [];

    // Faz várias tentativas para garantir uma boa lista
    for(let i=0; i<6; i++){
      const gid = genreIds[Math.floor(Math.random()*genreIds.length)];
      const pg  = Math.floor(Math.random()*6)+1; // 1..6 para variar
      try{
        const data = await fetchJSON(`/api/tmdb?type=movie&genreId=${gid}&page=${pg}`, {}, {retries:1});
        const withBackdrop = (data.results || []).filter(x=>x && x.backdrop_path);
        picks.push(...withBackdrop);
        if(picks.length >= 12) break; // já temos uma fila legal
      }catch(err){
        console.warn('Tentativa de banner falhou (continua):', err);
      }
    }

    featuredMovies = shuffleArray(picks).slice(0, 12);
    if(featuredMovies.length === 0){
      clearHeroLoading();
      // Mostra um estado digno mesmo sem itens
      featuredBanner.style.backgroundImage = 'none';
      heroTitle.textContent = "Sem destaques no momento";
      heroDesc.textContent  = "Tente novamente mais tarde ou faça uma busca.";
      heroWatchBtn.href     = AFFILIATE_LINK;
      return;
    }

    // Exibe imediatamente o primeiro
    showFeaturedBanner();
    clearHeroLoading();

    // Inicia rotação
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
  // Reinicia animação de fade
  featuredBanner.classList.remove('fade');
  void featuredBanner.offsetWidth;
  featuredBanner.classList.add('fade');

  featuredBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`;
  heroTitle.textContent = movie.title || "Destaque";
  heroDesc.textContent  = movie.overview || "Sem sinopse disponível";
  heroWatchBtn.href     = AFFILIATE_LINK;
}

// shuffle simples para variar banners
function shuffleArray(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// Botão “Ver Trailer” do banner
heroTrailerBtn.addEventListener('click',()=>{
  if(featuredMovieId) fetchTrailer(featuredMovieId,'movie',heroDesc.textContent);
});

/* ========================================================================
   TRAILER (Modal) — com fallback e idiomas
   ======================================================================== */
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

// tenta trailer pt-BR, depois en-US, depois speak
async function fetchTrailer(id,type,overview){
  try{
    // 1) tenta pt-BR
    let data = await tryTrailer(id,type,'pt-BR');
    if(!(data && data.key)){
      // 2) tenta en-US
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

/* ========================================================================
   NAVEGAÇÃO — mostrar/ocultar seções
   ======================================================================== */
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

/* ========================================================================
   HUMOR — conecta os botões de humor à busca
   ======================================================================== */
if(moodButtonsWrap){
  moodButtonsWrap.querySelectorAll('button[data-mood]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      // visual ativo
      moodButtonsWrap.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');

      const mood = (btn.dataset.mood || '').toLowerCase();
      const map  = MOOD_MAP[mood];
      if(map){
        // Dispara busca: “genero|tipo” para IA aceitar também
        const prompt = `${map.genero}|${map.type==='tv'?'série':'filme'}`;
        search(prompt);
      }else{
        // fallback: só usa o texto do botão
        search(mood || 'Ação');
      }
    });
  });
}

/* ========================================================================
   EVENTOS — busca / enter / surpreenda-me
   ======================================================================== */
searchButton.addEventListener('click',()=>search());
searchInput.addEventListener('keyup',e=>{ if(e.key==='Enter') search(); });
surpriseButton.addEventListener('click',()=>{
  const arr = Object.keys(movieGenres);
  const gen = arr[Math.floor(Math.random()*arr.length)];
  search(gen);
});

/* ========================================================================
   BOOT
   ======================================================================== */
renderGeneros();
resultsTitle.textContent = 'Top do momento';
loadFeatured(); // carrega banners depois que DOM está pronto

/* =========================================================================
   MORILLALFLIX — script.js (Pro Max 2025)
   IA robusta + re-ranking + preferências + cache + UX pro
   ========================================================================= */

/* ======= Seletores essenciais ======= */
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

/* ======= Config geral ======= */
const USER_LANG = (navigator.language || 'pt-BR').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
const MAX_PER_GENRE   = 12;      // por gênero
const MIN_VOTE_AVG    = 7.0;     // filtro de qualidade
const MIN_VOTE_COUNT  = 300;     // reforço client-side
const MIN_YEAR        = 2005;    // evita muito antigo
const RECENT_BOOST    = 2018;    // favorece pós-2018
const BANNER_MIN_VOTE = 7.0;

/* ======= Dicionários de gêneros ======= */
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

/* ======= HUMOR — enriquecido (multi-gênero + tipo sugerido) ======= */
const MOOD_MAP = {
  "animado":   { generos: "Ação,Aventura,Comédia", type: "movie" },
  "triste":    { generos: "Comédia,Romance",       type: "movie" },
  "assustado": { generos: "Terror,Thriller",       type: "movie" },
  "romântico": { generos: "Romance,Drama",         type: "movie" },
  "romantico": { generos: "Romance,Drama",         type: "movie" },
  "entediado": { generos: "Fantasia,Comédia",      type: "movie" },
  "nervoso":   { generos: "Thriller,Ação",         type: "movie" },
  "pensativo": { generos: "Drama,Mistério",        type: "movie" },
  "curioso":   { generos: "Mistério,Aventura",     type: "movie" },
  "futurista": { generos: "Ficção científica,Ação",type: "movie" },
  "família":   { generos: "Família,Animação",      type: "movie" },
  "familia":   { generos: "Família,Animação",      type: "movie" },
};

/* ======= Preferências do usuário (aprendizado simples) ======= */
const PREF_KEY = "morillaflix_prefs_v1";
const prefs = loadPrefs();
function loadPrefs(){
  try{ return JSON.parse(localStorage.getItem(PREF_KEY)) || { genres:{}, clicks:0 }; }catch{ return { genres:{}, clicks:0 }; }
}
function savePrefs(){ localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }
function bumpGenrePref(genreId){
  prefs.genres[genreId] = (prefs.genres[genreId] || 0) + 1;
  prefs.clicks += 1;
  savePrefs();
}

/* ======= Cache simples (sessão) ======= */
const cache = new Map();
function cacheKey(url){ return `cache:${url}`; }

/* ======= Infra util ======= */
async function fetchJSON(url, options = {}, { timeoutMs = 12000, retries = 1 } = {}){
  const key = cacheKey(url);
  if(cache.has(key)) return cache.get(key);

  for(let attempt=0; attempt<=retries; attempt++){
    const controller = new AbortController();
    const t = setTimeout(()=>controller.abort(), timeoutMs);
    try{
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cache.set(key, json);
      return json;
    }catch(err){
      clearTimeout(t);
      if(attempt === retries) throw err;
      await new Promise(r=>setTimeout(r, 400*(attempt+1)));
    }
  }
}

function renderStars(vote=0){
  const full = Math.floor(vote/2);
  const half = (vote/2 - full) >= 0.5 ? 1 : 0;
  const empty = 5-full-half;
  return '★'.repeat(full) + (half?'½':'') + '☆'.repeat(Math.max(0,empty));
}

function parseYear(item){
  const str = item.release_date || item.first_air_date || "";
  return (+String(str).slice(0,4)) || 0;
}

/* ======= Loading UI ======= */
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
  if(heroLoaderEl){ heroLoaderEl.remove(); heroLoaderEl = null; }
}

/* ======= Toast rápido ======= */
function toast(msg, type="info"){
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  Object.assign(el.style, {
    position:'fixed', bottom:'20px', left:'50%', transform:'translateX(-50%)',
    background: type==='error' ? '#b0060d' : '#222', color:'#fff',
    padding:'10px 14px', borderRadius:'10px', zIndex:2000, border:'1px solid #444'
  });
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3000);
}

/* ======= Cards ======= */
function createCard(item,type){
  const title   = item.title || item.name || "Sem título";
  const rating  = item.vote_average || 0;
  const poster  = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
  const overview= item.overview || "Sem sinopse disponível";
  const year    = parseYear(item);

  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="poster">${poster ? `<img src="${poster}" alt="${title}">` : ''}</div>
    <div class="card-info">
      <h3 title="${title}">${title}</h3>
      <p class="type">${type==='movie' ? 'Filme' : 'Série'} ${year?`• ${year}`:''}</p>
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

  // Expand/collapse
  const btn = el.querySelector('.toggle-overview');
  const txt = el.querySelector('.overview');
  let expanded = false;
  btn.addEventListener('click',()=>{
    expanded = !expanded;
    txt.style.maxHeight = expanded ? 'none' : '84px';
    btn.textContent = expanded ? 'Leia menos' : 'Leia mais';
  });

  // Clicks → reforça preferências do usuário
  el.querySelector('.watch-now').addEventListener('click', ()=>{
    (item.genre_ids || []).forEach(g => bumpGenrePref(g));
  });
  el.querySelector('.trailer-btn').addEventListener('click', ()=>{
    (item.genre_ids || []).forEach(g => bumpGenrePref(g));
    fetchTrailer(item.id,type,overview);
  });

  return el;
}

/* ======= Re-ranking inteligente =======
   - Prioriza: nota alta, muitos votos, ano recente, match com preferências
*/
function rerank(items){
  const out = [...items];
  const totalClicks = Math.max(1, prefs.clicks);
  const prefBoost = (gid)=> (prefs.genres[gid]||0) / totalClicks; // 0..1

  out.forEach(it=>{
    const year     = parseYear(it);
    const votes    = it.vote_count || 0;
    const avg      = it.vote_average || 0;
    const genreHit = (it.genre_ids||[]).reduce((acc,g)=> acc + prefBoost(g), 0) / Math.max(1,(it.genre_ids||[]).length);

    // score base
    let score = avg;

    // boost por votos (log para não explodir)
    score += Math.log10(1 + votes) * 0.8;

    // boost por ano
    if(year >= RECENT_BOOST) score += 0.8;
    else if(year >= MIN_YEAR) score += 0.3;

    // boost por preferência do usuário
    score += genreHit * 1.2;

    // pequeno ruído para evitar listas idênticas
    score += (Math.random() - 0.5) * 0.2;

    it.__score = score;
  });

  out.sort((a,b)=> (b.__score||0) - (a.__score||0));
  return out;
}

/* ======= Filtros de qualidade locais ======= */
function qualityFilter(list){
  return list.filter(x=>{
    const year = parseYear(x);
    const okVote = typeof x.vote_average === 'number' && x.vote_average >= MIN_VOTE_AVG;
    const okCount= (x.vote_count || 0) >= MIN_VOTE_COUNT;
    const okImg  = x.poster_path || x.backdrop_path;
    const okYear = year === 0 || year >= MIN_YEAR; // aceita sem data, mas filtra muito antigo
    return okVote && okCount && okImg && okYear;
  });
}

/* ======= Busca / Descoberta (cliente → sua API /api/tmdb) ======= */
async function fetchByGenre(type,genreId, page){
  const url = `/api/tmdb?type=${type}&genreId=${genreId}&page=${page}&language=${encodeURIComponent(USER_LANG)}&sort_by=popularity.desc`;
  const data = await fetchJSON(url, {}, {retries:1});
  const base = Array.isArray(data.results) ? data.results : [];
  const filtered = qualityFilter(base);
  const ranked = rerank(filtered);
  return ranked.slice(0, MAX_PER_GENRE);
}

/* ======= IA de interpretação (robusta + fallback) ======= */
async function askAI(prompt){
  // Contexto robusto para retorno no formato correto
  const context = `
Responda somente no formato: Genero1,Genero2|Filme ou Série
- Sem explicações. Sem texto extra.
- Se o usuário citar "série", use Série; se falar "filme", use Filme; caso não diga, use Filme.
Exemplos:
"quero ação e comédia" -> Ação,Comédia|Filme
"série de drama e romance" -> Drama,Romance|Série
"me indica terror" -> Terror|Filme
`.trim();

  try{
    const res = await fetchJSON('/api/openai', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt: `${context}\nUsuário: ${prompt}`})
    }, {retries:0});

    let raw = (res && res.result) ? String(res.result).trim() : "";
    raw = raw.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N},|]/gu, '');
    if(raw.includes('|')) return raw;

    // fallback heurístico
    return heuristicParse(prompt);
  }catch(e){
    // fallback heurístico
    return heuristicParse(prompt);
  }
}

function heuristicParse(input){
  const norm = normalize(input);
  let type = norm.includes('série') || norm.includes('serie') ? 'Série' : 'Filme';

  // Tenta mapear gêneros citados diretamente
  const keys = Object.keys(movieGenresNorm);
  const found = keys.filter(k => norm.includes(normalize(k)));
  if(found.length){
    const gens = found.map(k=>{
      // reconstitui nome “bonito” (primeira maiúscula) a partir do dicionário original
      return Object.keys(movieGenres).find(kk => normalize(kk)===k) || k;
    }).slice(0,3).join(',');
    return `${gens||'Ação'}|${type}`;
  }

  // Tenta humor
  const moodKey = Object.keys(MOOD_MAP).find(m => norm.includes(m));
  if(moodKey){
    const { generos } = MOOD_MAP[moodKey];
    return `${generos}|${type}`;
  }

  // fallback final
  return `Ação,Comédia|${type}`;
}

/* ======= Pesquisa principal ======= */
let lastQuery = null;
let currentType = 'movie';
let currentGeneros = [];
let currentPage = 1; // para "carregar mais"

function showLoadMore(){
  // cria/atualiza botão "Carregar mais"
  let btn = document.getElementById('load-more');
  if(!btn){
    btn = document.createElement('button');
    btn.id = 'load-more';
    btn.className = 'btn btn-secondary';
    btn.style.margin = '16px auto';
    btn.textContent = 'Carregar mais';
    btn.addEventListener('click', async ()=>{
      currentPage++;
      await search(lastQuery, { append:true });
    });
    resultsContainer.parentElement.appendChild(btn);
  }
  btn.style.display = 'block';
}
function hideLoadMore(){
  const btn = document.getElementById('load-more');
  if(btn) btn.style.display = 'none';
}

async function search(text=null, { append=false } = {}){
  const input = (text ?? searchInput.value).trim();
  if(!append){ currentPage = 1; }
  if(!input && !append) return;

  if(!append) showLoading();

  const ai = await askAI(input);
  let [generosRaw,tipoRaw] = ai.split('|').map(s=> (s||'').trim());
  let generos = (generosRaw || "").split(',').map(g=>g.trim()).filter(Boolean);

  if(!generos.length){
    const norm = normalize(input);
    const keys = Object.keys(movieGenresNorm);
    const found = keys.find(k => norm.includes(normalize(k)));
    generos = [ (found ? (Object.keys(movieGenres).find(K=> normalize(K)===found) || found) : "Ação") ];
  }

  const type = (tipoRaw && tipoRaw.toLowerCase().includes('série')) ? 'tv' :
               (tipoRaw && tipoRaw.toLowerCase().includes('serie')) ? 'tv' : 'movie';

  lastQuery = input;
  currentType = type;
  currentGeneros = generos;

  // Junta resultados de todos os gêneros pedidos
  let allResults = [];
  for(const genero of generos){
    const gid = movieGenresNorm[normalize(genero)] || tvGenresNorm[normalize(genero)];
    if(!gid) continue;

    // páginas 1..3 para diversidade quando "append"
    const page = Math.min(3, Math.max(1, currentPage));
    try{
      const items = await fetchByGenre(type,gid,page);
      allResults.push(...items);
    }catch(e){
      console.warn('fetchByGenre falhou:', e);
    }
  }

  // Deduplia
  const unique = [];
  const seen = new Set();
  for(const item of allResults){
    if(!seen.has(item.id)){
      seen.add(item.id);
      unique.push(item);
    }
  }

  // Render
  if(!append){
    resultsContainer.innerHTML = "";
  }
  unique.forEach(it => resultsContainer.appendChild(createCard(it,type)));

  // Fade
  if(!append){
    resultsContainer.style.opacity = "0";
    setTimeout(() => {
      resultsContainer.style.opacity = "1";
      resultsContainer.style.transition = "opacity 0.4s ease";
    }, 30);
  }

  resultsTitle.textContent = `Resultados (${unique.length}${append?'+':''})`;

  // Load more aparece se tivemos resultados (até limitar 3 páginas)
  if(unique.length && currentPage < 3) showLoadMore(); else hideLoadMore();

  if(!append){
    window.scrollTo({ top: resultsContainer.offsetTop - 70, behavior: 'smooth' });
  }
}

/* ======= Gêneros ======= */
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

/* ======= Banner de destaque (forte) ======= */
let featuredIndex = 0;
let featuredMovies = [];
let featuredMovieId = null;
let bannerTimer = null;

async function loadFeatured(){
  try{
    showHeroLoading();
    const genreIds = Object.values(movieGenres);
    const picks = [];

    // 6 lotes: diversidade por gêneros + páginas 1..2
    for(let i=0; i<6; i++){
      const gid = genreIds[Math.floor(Math.random()*genreIds.length)];
      const pg  = Math.floor(Math.random()*2)+1;
      try{
        const url = `/api/tmdb?type=movie&genreId=${gid}&page=${pg}&language=${encodeURIComponent(USER_LANG)}&sort_by=popularity.desc`;
        const data = await fetchJSON(url, {}, {retries:1});
        const withBackdrop = (data.results || []).filter(x =>
          x && x.backdrop_path &&
          (x.vote_average||0) >= BANNER_MIN_VOTE &&
          (x.vote_count||0) >= MIN_VOTE_COUNT &&
          (parseYear(x) >= MIN_YEAR)
        );
        picks.push(...withBackdrop);
        if(picks.length >= 24) break;
      }catch(err){
        console.warn('Tentativa banner falhou (continua):', err);
      }
    }

    featuredMovies = rerank(picks).slice(0, 12);
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
heroTrailerBtn?.addEventListener('click',()=>{
  if(featuredMovieId){
    const it = featuredMovies.find(m=>m.id===featuredMovieId) || {};
    (it.genre_ids||[]).forEach(g=>bumpGenrePref(g));
    fetchTrailer(featuredMovieId,'movie',heroDesc.textContent);
  }
});

/* ======= Trailer (modal) ======= */
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
document.getElementById('close-modal')?.addEventListener('click',closeTrailer);
document.getElementById('trailer-modal')?.addEventListener('click',e=>{
  if(e.target.id==='trailer-modal') closeTrailer();
});

async function fetchTrailer(id,type,overview){
  try{
    let data = await tryTrailer(id,type,'pt-BR');
    if(!(data && data.key)) data = await tryTrailer(id,type,'en-US');
    if(data && data.key) openTrailer(data.key);
    else speech(overview || "Sinopse não disponível.");
  }catch(e){
    console.error('fetchTrailer', e);
    speech(overview || "Não foi possível carregar o trailer.");
  }
}
async function tryTrailer(id,type,lang){
  try{
    return await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=${encodeURIComponent(lang)}`, {}, {retries:0});
  }catch(_){ return null; }
}
function speech(txt){
  try{
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = USER_LANG;
    u.rate = 1;
    speechSynthesis.speak(u);
  }catch{}
}

/* ======= Navegação ======= */
document.querySelectorAll('.navbar a').forEach(a=>{
  a.addEventListener('click',e=>{
    const target = a.dataset.nav;
    document.querySelectorAll('.navbar a').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    generosSection?.classList.remove('active');
    sobreSection?.classList.remove('active');

    if(target==='generos'){
      e.preventDefault();
      renderGeneros();
      generosSection?.classList.add('active');
      window.scrollTo({top:generosSection.offsetTop-70,behavior:'smooth'});
    }else if(target==='sobre'){
      e.preventDefault();
      sobreSection?.classList.add('active');
      window.scrollTo({top:sobreSection.offsetTop-70,behavior:'smooth'});
    }
  });
});

/* ======= HUMOR (cliques treinam preferências) ======= */
if(moodButtonsWrap){
  moodButtonsWrap.querySelectorAll('button[data-mood],button').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      moodButtonsWrap.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const mood = (btn.dataset.mood || btn.textContent || '').toLowerCase();
      const map  = MOOD_MAP[mood];
      if(map){
        // reforça preferências com os gêneros do humor
        map.generos.split(',').forEach(g=>{
          const gid = movieGenresNorm[normalize(g)] || tvGenresNorm[normalize(g)];
          if(gid) bumpGenrePref(gid);
        });
        await search(`${map.generos}|${map.type==='tv'?'Série':'Filme'}`);
      }else{
        await search(mood || 'Ação');
      }
    });
  });
}

/* ======= Eventos ======= */
searchButton?.addEventListener('click',()=>search());
searchInput?.addEventListener('keyup',e=>{ if(e.key==='Enter') search(); });
surpriseButton?.addEventListener('click',()=>{
  const arr = Object.keys(movieGenres);
  const gen = arr[Math.floor(Math.random()*arr.length)];
  search(gen);
});

/* ======= Boot ======= */
renderGeneros();
resultsTitle.textContent = 'Top do momento';
loadFeatured();

/* ======= Acessibilidade menor: setaria aria-live nos resultados (opcional) ======= */
// resultsContainer.setAttribute('aria-live','polite');

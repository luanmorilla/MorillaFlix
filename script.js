// ===== Seletores principais
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

// ===== Funções auxiliares
const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const movieGenresNorm = Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
const tvGenresNorm    = Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));

function renderStars(vote=0){
  const full = Math.floor(vote/2);
  const half = vote%2>=1 ? 1 : 0;
  const empty = 5-full-half;
  return '★'.repeat(full)+'½'.repeat(half)+'☆'.repeat(empty);
}

// ===== Loading nos resultados
function showLoading(){
  resultsContainer.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">Carregando recomendações…</span>
    </div>
  `;
}

// ===== Loading no banner
function showHeroLoading(){
  featuredBanner.style.backgroundImage = 'none';
  featuredBanner.innerHTML = `
    <div class="hero-loading">
      <div class="spinner"></div>
      <span class="loading-text">Carregando destaque…</span>
    </div>
  `;
}
function clearHeroLoading(){
  const heroLoading = document.querySelector('.hero-loading');
  if(heroLoading) heroLoading.remove();
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
      <button class="toggle-overview" type="button">Leia mais</button>
      <p class="meta">Nota: <span class="stars">${renderStars(rating)}</span></p>
      <div class="actions">
        <a class="watch-now" href="${AFFILIATE_LINK}" target="_blank" rel="noopener">🎬 Assistir agora</a>
        <button class="trailer-btn" type="button">🎥 Ver Trailer</button>
      </div>
    </div>
  `;

  const btn = el.querySelector('.toggle-overview');
  const txt = el.querySelector('.overview');
  let expanded = false;
  btn.addEventListener('click',()=>{
    expanded = !expanded;
    txt.style.maxHeight = expanded ? 'none' : '84px';
    btn.textContent = expanded ? 'Leia menos' : 'Leia mais';
  });

  el.querySelector('.trailer-btn').addEventListener('click',()=>fetchTrailer(item.id,type,overview));
  return el;
}

// ===== TMDb
async function fetchByGenre(type,genreId){
  try{
    const page = Math.floor(Math.random()*10)+1;
    const res = await fetch(`/api/tmdb?type=${type}&genreId=${genreId}&page=${page}`);
    if(!res.ok) throw new Error('TMDb falhou');
    const data = await res.json();
    return data.results || [];
  }catch(e){
    console.error(e);
    return [];
  }
}

// ===== IA
let iaContext = "";
async function askAI(prompt){
  try{
    const full = `Histórico:\n${iaContext}\nUsuário: ${prompt}\nResponda apenas "genero|tipo" (ex: Ação|filme).`;
    const res = await fetch('/api/openai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:full})});
    const data = await res.json();
    const answer = (data && data.result) ? String(data.result) : "";
    iaContext += `\nIA: ${answer}`;
    return answer;
  }catch(e){
    console.error('OpenAI error',e);
    return "";
  }
}

// ===== Busca principal
async function search(text=null){
  const input = (text ?? searchInput.value).trim();
  if(!input) return;
  showLoading();

  const ai = await askAI(input);
  let [genero,tipo] = ai.split('|').map(s=> (s||'').trim().toLowerCase());
  let type = (tipo==='série'||tipo==='serie') ? 'tv' : 'movie';

  let genreId = movieGenresNorm[normalize(genero)] || tvGenresNorm[normalize(genero)];
  if(!genreId){ type = 'movie'; genreId = movieGenres["Ação"]; }

  const items = await fetchByGenre(type,genreId);
  resultsContainer.innerHTML = "";
  items.forEach(it => resultsContainer.appendChild(createCard(it,type)));

  resultsContainer.style.opacity = "0";
  setTimeout(() => {
    resultsContainer.style.opacity = "1";
    resultsContainer.style.transition = "opacity 0.4s ease";
  }, 50);

  resultsTitle.textContent = `Resultados (${items.length})`;
}

// ===== Render gêneros
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

// ===== Banner automático com fallback =====
let featuredIndex = 0;
let featuredMovies = [];

async function loadFeatured(){
  try{
    showHeroLoading();
    const currentYear = new Date().getFullYear();
    const res = await fetch(`/api/tmdb?type=movie&sort_by=popularity.desc&year=${currentYear}&page=1`);
    const data = await res.json();

    // fallback para "populares" se o filtro de ano não retornar nada
    featuredMovies = (data.results || []).filter(x => x.backdrop_path);
    if(featuredMovies.length === 0){
      const res2 = await fetch(`/api/tmdb?type=movie&sort_by=popularity.desc&page=1`);
      const data2 = await res2.json();
      featuredMovies = (data2.results || []).filter(x => x.backdrop_path);
    }

    if(featuredMovies.length === 0) return;

    showFeaturedBanner();
    clearHeroLoading();

    setInterval(() => {
      featuredIndex = (featuredIndex + 1) % featuredMovies.length;
      showFeaturedBanner();
    }, 10000);
  }catch(e){
    console.error('banner',e);
  }
}

function showFeaturedBanner(){
  const movie = featuredMovies[featuredIndex];
  featuredMovieId = movie.id;
  featuredBanner.classList.remove('fade');
  void featuredBanner.offsetWidth;
  featuredBanner.classList.add('fade');
  featuredBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`;
  heroTitle.textContent = movie.title || "Destaque";
  heroDesc.textContent = movie.overview || "Sem sinopse disponível";
  heroWatchBtn.href = AFFILIATE_LINK;
}
heroTrailerBtn.addEventListener('click',()=>{ if(featuredMovieId) fetchTrailer(featuredMovieId,'movie'); });

// ===== Trailer Modal
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
document.getElementById('trailer-modal').addEventListener('click',e=>{ if(e.target.id==='trailer-modal') closeTrailer(); });

async function fetchTrailer(id,type,overview){
  try{
    const res = await fetch(`/api/tmdb/trailer?id=${id}&type=${type}`);
    const data = await res.json();
    if(data && data.key){
      openTrailer(data.key);
    } else {
      // Fallback se não tiver trailer
      speak(overview || "Sinopse não disponível.");
    }
  }catch(e){
    console.error(e);
    speak(overview || "Não foi possível carregar o trailer.");
  }
}
function speak(txt){
  const u = new SpeechSynthesisUtterance(txt);
  u.lang='pt-BR'; u.rate=1;
  speechSynthesis.speak(u);
}

// ===== Navegação entre seções
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
      window.scrollTo({top:generosSection.offsetTop-60,behavior:'smooth'});
    }else if(target==='sobre'){
      e.preventDefault();
      sobreSection.classList.add('active');
      window.scrollTo({top:sobreSection.offsetTop-60,behavior:'smooth'});
    }
  });
});

// ===== Eventos
searchButton.addEventListener('click',()=>search());
searchInput.addEventListener('keyup',e=>{ if(e.key==='Enter') search(); });
surpriseButton.addEventListener('click',()=>{
  const arr = Object.keys(movieGenres);
  const gen = arr[Math.floor(Math.random()*arr.length)];
  search(gen);
});

// ===== Boot
loadFeatured();
renderGeneros();
resultsTitle.textContent = 'Top do momento';

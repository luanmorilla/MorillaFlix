/* =========================================================================
   MORILLALFLIX — script.js (PRO MAX FINAL 2025 — Studio Grade + IA FIX 2.1)
   =========================================================================
   Correções desta versão:
   - Força FILME quando o usuário digita um gênero (ex.: “Comédia”, “Terror”)
   - Mantém tipo SÉRIE apenas se o usuário pedir explicitamente ou a IA indicar e o input não for só gênero
   - createCard no markup compatível com seu CSS (.card + sinopse + botões grandes)
   - Filtros de qualidade + re-ranking preservados
   ========================================================================= */

   const featuredBanner    = document.querySelector('.hero');
   const heroTrailerBtn    = document.getElementById('hero-trailer-btn');
   const resultsTitle      = document.querySelector('.results-section h3');
   const resultsContainer  = document.getElementById('results');
   const searchInput       = document.getElementById('search-input');
   const searchButton      = document.getElementById('search-button');
   const surpriseButton    = document.getElementById('surprise-button');
   const generosSection    = document.querySelector('.generos-section');
   const sobreSection      = document.querySelector('.sobre-section');
   const generosContainer  = document.getElementById('generos-container');
   const moodButtonsWrap   = document.querySelector('.mood-buttons');
   
   const heroTitle         = document.getElementById('hero-title');
   const heroDesc          = document.getElementById('hero-description');
   const heroWatchBtn      = document.getElementById('hero-watch-btn');
   
   const avaliacoesSection = document.getElementById('avaliacoes');
   const starRatingWrap    = document.getElementById('star-rating');
   const comentarioInput   = document.getElementById('comentario');
   const enviarAvaliacaoBtn= document.getElementById('enviar-avaliacao');
   const avaliacoesLista   = document.getElementById('avaliacoes-lista');
   
   const AFFILIATE_LINK    = "https://ev.braip.com/ref?pv=provwxxd&af=afi9em9m17";
   const USER_LANG         = (navigator.language || 'pt-BR').toLowerCase().includes('pt') ? 'pt-BR' : 'en-US';
   const MAX_PER_GENRE     = 12;
   const MIN_VOTE_AVG      = 7.0;
   const MIN_VOTE_COUNT    = 300;
   const MIN_YEAR          = 2005;
   const RECENT_BOOST      = 2018;
   const BANNER_MIN_VOTE   = 7.0;
   const MAX_PAGES_APPEND  = 3;
   
   /* =======================
      1) DICIONÁRIOS GÊNERO
      ======================= */
   const movieGenres = {
     "Ação": 28, "Aventura": 12, "Animação": 16, "Comédia": 35, "Crime": 80,
     "Documentário": 99, "Drama": 18, "Família": 10751, "Fantasia": 14,
     "História": 36, "Terror": 27, "Música": 10402, "Mistério": 9648,
     "Romance": 10749, "Ficção científica": 878, "Filme de TV": 10770,
     "Thriller": 53, "Guerra": 10752, "Faroeste": 37
   };
   const tvGenres = {
     "Ação e Aventura": 10759, "Animação": 16, "Comédia": 35, "Crime": 80,
     "Documentário": 99, "Drama": 18, "Família": 10751, "Kids": 10762,
     "Mistério": 9648, "Notícias": 10763, "Reality": 10764,
     "Ficção científica e Fantasia": 10765, "Talk Show": 10767,
     "Guerra e Política": 10768, "Faroeste": 37
   };
   const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
   const movieGenresNorm = Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
   const tvGenresNorm    = Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));
   const allMovieGenreKeysNorm = Object.keys(movieGenresNorm);
   
   /* =======================
      2) HUMOR → gêneros
      ======================= */
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
   
   /* =====================================
      3) PREFERÊNCIAS / FAVORITOS / REVIEWS
      ===================================== */
   const PREF_KEY   = "morillaflix_prefs_v2";
   const FAV_KEY    = "morillaflix_favorites_v1";
   const RATING_KEY = "morillaflix_reviews_v1";
   
   const prefs = loadJSON(PREF_KEY, { genres:{}, clicks:0, lastSeenIds:[] });
   function bumpPref(genreId){ prefs.genres[genreId] = (prefs.genres[genreId]||0) + 1; prefs.clicks += 1; saveJSON(PREF_KEY, prefs); }
   
   const favorites = loadJSON(FAV_KEY, { items:[] });
   function isFav(id){ return favorites.items.some(x => x.id === id); }
   function toggleFav(movieObj){
     const idx = favorites.items.findIndex(x => x.id === movieObj.id);
     if(idx >= 0) favorites.items.splice(idx,1);
     else{
       favorites.items.unshift({
         id: movieObj.id,
         title: movieObj.title || movieObj.name || "Sem título",
         poster_path: movieObj.poster_path || null,
         backdrop_path: movieObj.backdrop_path || null,
         vote_average: movieObj.vote_average || 0,
         vote_count: movieObj.vote_count || 0,
         overview: movieObj.overview || "",
         type: movieObj.media_type || 'movie',
         release_date: movieObj.release_date || movieObj.first_air_date || ''
       });
       if(favorites.items.length > 200) favorites.items.length = 200;
     }
     saveJSON(FAV_KEY, favorites);
   }
   
   const reviews = loadJSON(RATING_KEY, { items:[] });
   function addReview(stars, text){
     reviews.items.unshift({ stars, text, date: Date.now() });
     if(reviews.items.length > 100) reviews.items.length = 100;
     saveJSON(RATING_KEY, reviews);
   }
   
   /* ========================
      4) CACHE / FETCH helper
      ======================== */
   const cache = new Map();
   function cacheKey(url){ return `cache:${url}`; }
   function expireCache(k, ms=6e5){ setTimeout(()=> cache.delete(k), ms); }
   
   async function fetchJSON(url, options = {}, { timeoutMs = 12000, retries = 1, clearCache=false } = {}){
     const key = cacheKey(url);
     if(clearCache) cache.delete(key);
     if(cache.has(key)) return cache.get(key);
   
     for(let attempt = 0; attempt <= retries; attempt++){
       const controller = new AbortController();
       const t = setTimeout(()=> controller.abort(), timeoutMs);
       try{
         const res = await fetch(url, { ...options, signal: controller.signal });
         clearTimeout(t);
         if(!res.ok) throw new Error(`HTTP ${res.status}`);
         const data = await res.json();
         cache.set(key, data);
         expireCache(key);
         return data;
       }catch(err){
         clearTimeout(t);
         if(attempt === retries) throw err;
         await sleep(300 * (attempt + 1));
       }
     }
   }
   function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
   function saveJSON(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{} }
   function loadJSON(key, def){ try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }catch{ return def; } }
   
   /* ============================
      5) FORMATAÇÕES / UTIL
      ============================ */
   function renderStars(vote = 0){
     const full = Math.floor(vote / 2);
     const half = (vote/2 - full) >= 0.5 ? 1 : 0;
     const empty = 5 - full - half;
     return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, empty));
   }
   function parseYear(item){
     const str = item.release_date || item.first_air_date || "";
     const y = (+String(str).slice(0,4)) || 0;
     return y;
   }
   function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
   function uniqById(list){
     const map = new Map();
     for(const it of list){ if(it && !map.has(it.id)) map.set(it.id, it); }
     return [...map.values()];
   }
   function titleOf(it){ return it.title || it.name || 'Sem título'; }
   
   /* ==========================
      6) TOASTS / LOADERS (UX)
      ========================== */
   function toast(msg, type="info"){
     const el = document.createElement('div');
     el.className = `toast ${type}`;
     Object.assign(el.style, {
       position:'fixed', bottom:'20px', left:'50%', transform:'translateX(-50%)',
       background: type==='error' ? '#b0060d' : '#111', color:'#fff',
       padding:'10px 14px', borderRadius:'10px', zIndex:2000, border:'1px solid #444',
       fontSize:'0.95rem', boxShadow:'0 4px 16px rgba(0,0,0,.45)'
     });
     el.textContent = msg;
     document.body.appendChild(el);
     setTimeout(()=> el.remove(), 3000);
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
     if(heroLoaderEl){ heroLoaderEl.remove(); heroLoaderEl = null; }
   }
   
   /* ==========================================
      7) IA DE INTERPRETAÇÃO (com fallback)
      ========================================== */
   async function askAI(prompt){
     const context = `
   Responda somente no formato: Genero1,Genero2|Filme ou Série
   Sem explicações. Sem texto extra.
   Se o usuário citar "série", use Série; se falar "filme", use Filme; caso não diga, use Filme.
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
       }, {retries:0, clearCache:true});
   
       let raw = (res && res.result) ? String(res.result).trim() : "";
       raw = raw.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N},|]/gu, '');
       if(raw.includes('|')) return raw;
   
       return heuristicParse(prompt);
     }catch{
       return heuristicParse(prompt);
     }
   }
   
   function heuristicParse(input){
     const norm = normalize(input);
     let type = norm.includes('série') || norm.includes('serie') ? 'Série' : 'Filme';
     const all = Object.keys(movieGenresNorm);
     const found = all.filter(k => norm.includes(k));
     if(found.length){
       const gens = found.slice(0,3).map(k => Object.keys(movieGenres).find(K => normalize(K)===k) || k).join(',');
       return `${gens || 'Ação'}|${type}`;
     }
     const moodKey = Object.keys(MOOD_MAP).find(m => norm.includes(m));
     if(moodKey){
       return `${MOOD_MAP[moodKey].generos}|${type}`;
     }
     return `Ação,Comédia|${type}`;
   }
   
   /* =======================================
      8) RE-RANKING + FILTROS DE QUALIDADE
      ======================================= */
   function rerank(items){
     const out = [...items];
     const totalClicks = Math.max(1, prefs.clicks);
     const prefBoost = (gid)=> (prefs.genres[gid]||0) / totalClicks;
   
     out.forEach(it=>{
       const year  = parseYear(it);
       const votes = it.vote_count || 0;
       const avg   = it.vote_average || 0;
       const genreHit = (it.genre_ids||[]).reduce((acc,g)=> acc + prefBoost(g), 0) / Math.max(1,(it.genre_ids||[]).length);
       let score = avg;
       score += Math.log10(1 + votes) * 0.8;
       if(year >= RECENT_BOOST) score += 0.9;
       else if(year >= MIN_YEAR) score += 0.35;
       score += genreHit * 1.3;
       score += (Math.random() - 0.5) * 0.25;
       it.__score = score;
     });
     out.sort((a,b)=> (b.__score||0) - (a.__score||0));
     return out;
   }
   
   function qualityFilter(list){
     return list.filter(x=>{
       const year = parseYear(x);
       const okVote = typeof x.vote_average === 'number' && x.vote_average >= MIN_VOTE_AVG;
       const okCount= (x.vote_count || 0) >= MIN_VOTE_COUNT;
       const okImg  = x.poster_path || x.backdrop_path;
       const okYear = (year === 0) || (year >= MIN_YEAR);
       return okVote && okCount && okImg && okYear;
     });
   }
   
   /* ====================================
      9) TMDb DISCOVERY (via /api/tmdb)
      ==================================== */
   async function fetchByGenre(type, genreId, page){
     const randomPage = Math.floor(Math.random() * 3) + 1;
     const finalPage = page || randomPage;
   
     // preferimos popularidade para diversidade
     const url = `/api/tmdb?type=${type}&genreId=${genreId}&page=${finalPage}&language=${encodeURIComponent(USER_LANG)}&sort_by=popularity.desc`;
     const data = await fetchJSON(url, {}, { retries: 1, clearCache:true });
   
     const base = Array.isArray(data.results) ? data.results : [];
     const filtered = qualityFilter(base);
     const ranked = rerank(filtered);
     return ranked.slice(0, MAX_PER_GENRE);
   }
   
   /* ===================================
      10) CREATE CARD — compatível c/ CSS
      =================================== */
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
   
     // Leia mais/menos
     const btn = el.querySelector('.toggle-overview');
     const txt = el.querySelector('.overview');
     let expanded = false;
     btn.addEventListener('click',()=>{
       expanded = !expanded;
       txt.style.maxHeight = expanded ? 'none' : '84px';
       btn.textContent = expanded ? 'Leia menos' : 'Leia mais';
     });
   
     // Trailer
     el.querySelector('.trailer-btn').addEventListener('click',()=>{
       bumpPref((item.genre_ids||[])[0] || 0);
       fetchTrailer(item.id,type,overview);
     });
   
     return el;
   }
   
   /* ===================================
      11) PESQUISA PRINCIPAL + LOAD MORE
      =================================== */
   let lastQuery = null;
   let currentType = 'movie';
   let currentGeneros = [];
   let currentPage = 1;
   
   function showLoadMore(){
     let btn = document.getElementById('load-more');
     if(!btn){
       btn = document.createElement('button');
       btn.id = 'load-more';
       btn.className = 'btn btn-secondary';
       btn.style.margin = '16px auto';
       btn.textContent = 'Carregar mais';
       btn.addEventListener('click', async ()=>{
         currentPage = clamp(currentPage + 1, 1, MAX_PAGES_APPEND);
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
   function debounce(fn, delay=320){ let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }
   const debouncedSearch = debounce((q)=> search(q), 250);
   
   /* 🔍 Busca com força-FILME quando input é só gênero */
   async function search(text=null, { append=false } = {}){
     const input = (text ?? searchInput.value).trim();
     if(!append){ currentPage = 1; }
     if(!input && !append) return;
   
     if(!append) {
       showLoading();
       cache.clear();
     }
   
     const ai = await askAI(input);
     let [generosRaw, tipoRaw] = (ai || '').split('|').map(s=> (s||'').trim());
     let generos = (generosRaw || "").split(',').map(g=>g.trim()).filter(Boolean);
   
     // ⚠️ Se o usuário digitou um GÊNERO de filme (ex.: "Comédia") e NÃO disse "série",
     // forçamos MOVIE para evitar casos como The Last of Us.
     const normInput = normalize(input);
     const userSaidSerie = normInput.includes('série') || normInput.includes('serie');
     const inputIsPureMovieGenre = allMovieGenreKeysNorm.some(k => normInput === k || normInput.includes(k));
   
     let type = 'movie';
     if(userSaidSerie && !inputIsPureMovieGenre){
       type = 'tv';
     }else if(tipoRaw){
       type = (tipoRaw.toLowerCase().includes('série') || tipoRaw.toLowerCase().includes('serie')) ? 'tv' : 'movie';
     } // senão mantém movie
   
     if(!generos.length){
       const keys = Object.keys(movieGenresNorm);
       const found = keys.find(k => normInput.includes(k));
       generos = [ (found ? (Object.keys(movieGenres).find(K=> normalize(K)===found) || found) : "Ação") ];
     }
   
     lastQuery = input;
     currentType = type;
     currentGeneros = generos;
   
     let allResults = [];
     for(const genero of generos){
       const gid = movieGenresNorm[normalize(genero)] || tvGenresNorm[normalize(genero)];
       if(!gid) continue;
       const randomPage = Math.floor(Math.random() * 3) + 1;
       try{
         const items = await fetchByGenre(type, gid, randomPage);
         allResults.push(...items);
       }catch(e){
         console.warn('fetchByGenre falhou:', e);
       }
     }
   
     const unique = uniqById(allResults);
   
     if(!append){
       resultsContainer.style.opacity = "0";
       setTimeout(()=> resultsContainer.innerHTML = "", 80);
     }
   
     setTimeout(()=>{
       unique.forEach(it => resultsContainer.appendChild(createCard(it,type)));
       resultsContainer.style.transition = "opacity 0.5s ease";
       resultsContainer.style.opacity = "1";
     }, 160);
   
     resultsTitle.textContent = `Resultados (${unique.length}${append?'+':''})`;
     if(unique.length && currentPage < MAX_PAGES_APPEND) showLoadMore(); else hideLoadMore();
     if(!append){ window.scrollTo({ top: resultsContainer.offsetTop - 70, behavior: 'smooth' }); }
   }
   
   /* ===========================
      12) LISTA DE GÊNEROS
      =========================== */
   function renderGeneros(){
     if(!generosContainer) return;
     generosContainer.innerHTML = "";
     Object.keys(movieGenres).forEach(gen=>{
       const b=document.createElement('button');
       b.textContent = gen;
       b.addEventListener('click',()=> search(gen));
       generosContainer.appendChild(b);
     });
   }
   
   /* ===========================
      13) FAVORITOS
      =========================== */
   function renderFavoritos(){
     resultsContainer.innerHTML = "";
     const favs = favorites.items || [];
     if(!favs.length){
       resultsTitle.textContent = 'Favoritos (0)';
       resultsContainer.innerHTML = `
         <div class="loading-container">
           <span class="loading-text">Nenhum favorito ainda. Adicione clicando em “☆ Favorito”.</span>
         </div>`;
       hideLoadMore();
       return;
     }
     const cards = favs.map(f => {
       const full = {
         id: f.id, title: f.title, name: f.title,
         poster_path: f.poster_path, backdrop_path: f.backdrop_path,
         vote_average: f.vote_average, vote_count: f.vote_count,
         overview: f.overview, release_date: f.release_date,
         first_air_date: f.release_date, genre_ids: [],
       };
       return createCard(full, (f.type || 'movie'));
     });
     cards.forEach(c => resultsContainer.appendChild(c));
     resultsTitle.textContent = `Favoritos (${favs.length})`;
     hideLoadMore();
   }
   
   /* ======================================================
      14) BANNER (destaques)
      ====================================================== */
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
         const pg  = Math.floor(Math.random()*3)+1;
         try{
           const url = `/api/tmdb?type=movie&genreId=${gid}&page=${pg}&language=${encodeURIComponent(USER_LANG)}&sort_by=popularity.desc`;
           const data = await fetchJSON(url, {}, {retries:1, clearCache:true});
           const withBackdrop = (data.results || []).filter(x =>
             x && x.backdrop_path &&
             (x.vote_average||0) >= BANNER_MIN_VOTE &&
             (x.vote_count||0) >= MIN_VOTE_COUNT &&
             (parseYear(x) >= MIN_YEAR)
           );
           picks.push(...withBackdrop);
           if(picks.length >= 28) break;
         }catch(err){
           console.warn('Tentativa banner falhou (continua):', err);
         }
       }
   
       featuredMovies = rerank(uniqById(picks)).slice(0, 12);
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
   
   heroTrailerBtn?.addEventListener('click', ()=>{
     if(featuredMovieId){
       const it = featuredMovies.find(m=>m.id===featuredMovieId) || {};
       (it.genre_ids||[]).forEach(g=> bumpPref(g));
       fetchTrailer(featuredMovieId,'movie',heroDesc.textContent);
     }
   });
   
   /* ====================================
      15) TRAILER (modal + fallback)
      ==================================== */
   function openTrailer(key){
     const modal = document.getElementById('trailer-modal');
     const iframe = document.getElementById('trailer-video');
     if(!modal || !iframe) return;
     iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1`;
     modal.style.display='flex';
     modal.setAttribute('aria-hidden','false');
   }
   function closeTrailer(){
     const modal = document.getElementById('trailer-modal');
     const iframe = document.getElementById('trailer-video');
     if(!modal || !iframe) return;
     iframe.src = '';
     modal.style.display='none';
     modal.setAttribute('aria-hidden','true');
   }
   document.getElementById('close-modal')?.addEventListener('click', closeTrailer);
   document.getElementById('trailer-modal')?.addEventListener('click', e=>{
     if(e.target.id === 'trailer-modal') closeTrailer();
   });
   
   async function fetchTrailer(id, type, overview){
     try{
       let data = await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=pt-BR`, {}, {retries:0});
       if(!(data && data.key)) data = await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=en-US`, {}, {retries:0});
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
   
   function speak(txt){
     try{
       const u = new SpeechSynthesisUtterance(txt);
       u.lang = USER_LANG;
       u.rate = 1;
       speechSynthesis.speak(u);
     }catch{}
   }
   
   /* ==========================
      16) NAVEGAÇÃO
      ========================== */
   document.querySelectorAll('.navbar a').forEach(a=>{
     a.addEventListener('click', e=>{
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
       }else if(target==='favoritos'){
         e.preventDefault();
         renderFavoritos();
         window.scrollTo({top:resultsContainer.offsetTop-70,behavior:'smooth'});
       }else if(target==='inicio'){
         e.preventDefault();
         resultsTitle.textContent = 'Top do momento';
         window.scrollTo({top:0,behavior:'smooth'});
       }
     });
   });
   
   /* ==========================
      17) HUMOR
      ========================== */
   if(moodButtonsWrap){
     moodButtonsWrap.querySelectorAll('button[data-mood],button').forEach(btn=>{
       btn.addEventListener('click', async ()=>{
         moodButtonsWrap.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
         btn.classList.add('active');
         const mood = (btn.dataset.mood || btn.textContent || '').toLowerCase().trim();
         const map  = MOOD_MAP[mood];
         if(map){
           map.generos.split(',').forEach(g=>{
             const gid = movieGenresNorm[normalize(g)] || tvGenresNorm[normalize(g)];
             if(gid) bumpPref(gid);
           });
           await search(`${map.generos}|Filme`);
         }else{
           await search(mood || 'Ação');
         }
       });
     });
   }
   
   /* ==========================
      18) EVENTOS
      ========================== */
   searchButton?.addEventListener('click', ()=> search());
   searchInput?.addEventListener('keyup', e=>{ if(e.key==='Enter') search(); });
   surpriseButton?.addEventListener('click', ()=>{
     const arr = Object.keys(movieGenres);
     const gen = arr[Math.floor(Math.random()*arr.length)];
     search(gen);
   });
   
   /* ==========================
      19) AVALIAÇÕES
      ========================== */
   function initReviews(){
     if(!starRatingWrap || !enviarAvaliacaoBtn || !avaliacoesLista) return;
     let selected = 0;
     const stars = Array.from(starRatingWrap.querySelectorAll('span[data-value]'));
     stars.forEach(star=>{
       star.addEventListener('mouseenter', ()=>{
         const v = +star.dataset.value;
         stars.forEach(s=> s.style.color = (+s.dataset.value <= v) ? '#e50914' : '#444');
       });
       star.addEventListener('mouseleave', ()=>{
         stars.forEach(s=> s.style.color = (+s.dataset.value <= selected) ? '#e50914' : '#444');
       });
       star.addEventListener('click', ()=>{
         selected = +star.dataset.value;
         stars.forEach(s=> s.classList.toggle('selected', +s.dataset.value <= selected));
       });
     });
   
     enviarAvaliacaoBtn.addEventListener('click', ()=>{
       const text = (comentarioInput?.value || '').trim();
       if(!selected){ toast('Escolha uma nota (★).','error'); return; }
       if(text.length < 3){ toast('Escreva um comentário.','error'); return; }
       addReview(selected, text);
       comentarioInput.value = '';
       selected = 0;
       stars.forEach(s=>{ s.classList.remove('selected'); s.style.color = '#444'; });
       renderReviewsList();
       toast('Avaliação enviada!');
     });
     renderReviewsList();
   }
   
   function renderReviewsList(){
     if(!avaliacoesLista) return;
     const arr = reviews.items || [];
     if(!arr.length){
       avaliacoesLista.innerHTML = `
         <div class="avaliacao-item">
           <div class="estrelas">Seja o primeiro a avaliar!</div>
           <p>Conte como o MorillaFlix te ajuda a escolher filmes.</p>
         </div>`;
       return;
     }
     avaliacoesLista.innerHTML = '';
     arr.forEach(r=>{
       const d = new Date(r.date || Date.now());
       const item = document.createElement('div');
       item.className = 'avaliacao-item';
       item.innerHTML = `
         <div class="estrelas">${'★'.repeat(clamp(r.stars||0,1,5))}</div>
         <p>${escapeHtml(r.text||'')}</p>
         <small style="opacity:.75">em ${d.toLocaleDateString()}</small>
       `;
       avaliacoesLista.appendChild(item);
     });
   }
   function escapeHtml(s){
     return String(s).replace(/[&<>"'/]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#47;' }[m]));
   }
   
   /* ==========================
      20) BOOT
      ========================== */
   function boot(){
     try{
       renderGeneros();
       initReviews();
       resultsTitle.textContent = 'Top do momento';
       loadFeatured();
     }catch(err){
       console.error('Boot error:', err);
     }
   }
   boot();
   
   /* =====================================================================
      21) Infinite Scroll (opcional)
      ===================================================================== */
   // window.addEventListener('scroll', ()=>{
   //   const btn = document.getElementById('load-more');
   //   if(!btn || btn.style.display==='none') return;
   //   const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 600;
   //   if(nearBottom){ btn.click(); }
   // });
   
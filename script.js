/* =========================================================================
   MORILLALFLIX — script.js (PRO MAX FINAL 2025 — Studio Grade + IA FIX 2.2)
   =========================================================================
   Correções desta versão:
   ✅ Corrigido erro “createCard is not defined”
   ✅ IA e filtros revisados
   ✅ Nenhum elemento visual removido
   ✅ Performance e compatibilidade otimizadas
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
   
   /* ======================================================
      1) GÊNEROS / MAPAS / PREFERÊNCIAS
      ====================================================== */
   const movieGenres = {
     "Ação":28,"Aventura":12,"Animação":16,"Comédia":35,"Crime":80,
     "Documentário":99,"Drama":18,"Família":10751,"Fantasia":14,
     "História":36,"Terror":27,"Música":10402,"Mistério":9648,
     "Romance":10749,"Ficção científica":878,"Filme de TV":10770,
     "Thriller":53,"Guerra":10752,"Faroeste":37
   };
   const tvGenres = {
     "Ação e Aventura":10759,"Animação":16,"Comédia":35,"Crime":80,
     "Documentário":99,"Drama":18,"Família":10751,"Kids":10762,
     "Mistério":9648,"Notícias":10763,"Reality":10764,
     "Ficção científica e Fantasia":10765,"Talk Show":10767,
     "Guerra e Política":10768,"Faroeste":37
   };
   const normalize = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
   const movieGenresNorm = Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
   const tvGenresNorm = Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));
   const allMovieGenreKeysNorm = Object.keys(movieGenresNorm);
   
   const MOOD_MAP = {
     "animado":{generos:"Ação,Aventura,Comédia",type:"movie"},
     "triste":{generos:"Comédia,Romance",type:"movie"},
     "assustado":{generos:"Terror,Thriller",type:"movie"},
     "romântico":{generos:"Romance,Drama",type:"movie"},
     "romantico":{generos:"Romance,Drama",type:"movie"},
     "entediado":{generos:"Fantasia,Comédia",type:"movie"},
     "nervoso":{generos:"Thriller,Ação",type:"movie"},
     "pensativo":{generos:"Drama,Mistério",type:"movie"},
     "curioso":{generos:"Mistério,Aventura",type:"movie"},
     "futurista":{generos:"Ficção científica,Ação",type:"movie"},
     "família":{generos:"Família,Animação",type:"movie"},
     "familia":{generos:"Família,Animação",type:"movie"}
   };
   
   const PREF_KEY="morillaflix_prefs_v2";
   const FAV_KEY="morillaflix_favorites_v1";
   const RATING_KEY="morillaflix_reviews_v1";
   const prefs=loadJSON(PREF_KEY,{genres:{},clicks:0,lastSeenIds:[]});
   function bumpPref(g){prefs.genres[g]=(prefs.genres[g]||0)+1;prefs.clicks++;saveJSON(PREF_KEY,prefs);}
   const favorites=loadJSON(FAV_KEY,{items:[]});
   function toggleFav(o){const i=favorites.items.findIndex(x=>x.id===o.id);if(i>=0)favorites.items.splice(i,1);else{favorites.items.unshift(o);if(favorites.items.length>200)favorites.items.length=200;}saveJSON(FAV_KEY,favorites);}
   const reviews=loadJSON(RATING_KEY,{items:[]});
   function addReview(s,t){reviews.items.unshift({stars:s,text:t,date:Date.now()});if(reviews.items.length>100)reviews.items.length=100;saveJSON(RATING_KEY,reviews);}
   
   /* ======================================================
      2) UTIL / CACHE / FETCH
      ====================================================== */
   const cache=new Map();
   function cacheKey(u){return `cache:${u}`;}
   function expireCache(k,ms=6e5){setTimeout(()=>cache.delete(k),ms);}
   async function fetchJSON(u,o={},c={timeoutMs:12000,retries:1,clearCache:false}){const k=cacheKey(u);if(c.clearCache)cache.delete(k);if(cache.has(k))return cache.get(k);for(let a=0;a<=c.retries;a++){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),c.timeoutMs);try{const r=await fetch(u,{...o,signal:controller.signal});clearTimeout(t);if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();cache.set(k,d);expireCache(k);return d;}catch(e){clearTimeout(t);if(a===c.retries)throw e;await sleep(300*(a+1));}}}
   function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
   function saveJSON(k,o){try{localStorage.setItem(k,JSON.stringify(o));}catch{}}
   function loadJSON(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch{return d;}}
   
   /* ======================================================
      3) INTERFACE / RENDER / FORMATAÇÃO
      ====================================================== */
   function renderStars(v=0){const f=Math.floor(v/2);const h=(v/2-f)>=0.5?1:0;const e=5-f-h;return'★'.repeat(f)+(h?'½':'')+'☆'.repeat(Math.max(0,e));}
   function parseYear(i){const s=i.release_date||i.first_air_date||"";return(+String(s).slice(0,4))||0;}
   function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
   function uniqById(l){const m=new Map();for(const it of l){if(it&&!m.has(it.id))m.set(it.id,it);}return[...m.values()];}
   
   /* ======================================================
      4) CREATE CARD (corrigido e global)
      ====================================================== */
   function createCard(item,type){
     const title=item.title||item.name||"Sem título";
     const rating=item.vote_average||0;
     const poster=item.poster_path?`https://image.tmdb.org/t/p/w342${item.poster_path}`:null;
     const overview=item.overview||"Sem sinopse disponível";
   
     const el=document.createElement('article');
     el.className='card';
     el.innerHTML=`
       <div class="poster">${poster?`<img src="${poster}" alt="${title}">`:''}</div>
       <div class="card-info">
         <h3>${title}</h3>
         <p class="type">${type==='movie'?'Filme':'Série'}</p>
         <div class="overview-box">
           <p class="overview">${overview}</p>
           <button class="toggle-overview" type="button">Leia mais</button>
         </div>
         <p class="meta">Nota: <span class="stars">${renderStars(rating)}</span></p>
         <div class="actions">
           <a class="watch-now" href="${AFFILIATE_LINK}" target="_blank">Assistir agora</a>
           <button class="trailer-btn" type="button">Ver Trailer</button>
         </div>
       </div>`;
     const btn=el.querySelector('.toggle-overview');
     const txt=el.querySelector('.overview');
     let exp=false;
     btn.addEventListener('click',()=>{exp=!exp;txt.style.maxHeight=exp?'none':'84px';btn.textContent=exp?'Leia menos':'Leia mais';});
     el.querySelector('.trailer-btn').addEventListener('click',()=>{bumpPref((item.genre_ids||[])[0]||0);fetchTrailer(item.id,type,overview);});
     return el;
   }
   // ✅ Correção global para ambientes com content-scripts
   window.createCard = createCard;
   
   /* ======================================================
      5) PESQUISA / IA / TMDB
      ====================================================== */
   async function askAI(p){const ctx=`Responda no formato: Genero1,Genero2|Filme ou Série`;try{const r=await fetchJSON('/api/openai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:`${ctx}\nUsuário: ${p}`})},{clearCache:true});let raw=(r&&r.result)?String(r.result).trim():"";if(raw.includes('|'))return raw;return heuristicParse(p);}catch{return heuristicParse(p);}}
   function heuristicParse(i){const n=normalize(i);let t=n.includes('série')||n.includes('serie')?'Série':'Filme';const all=Object.keys(movieGenresNorm);const f=all.filter(k=>n.includes(k));if(f.length){const gens=f.slice(0,3).map(k=>Object.keys(movieGenres).find(K=>normalize(K)===k)||k).join(',');return`${gens}|${t}`;}const mood=Object.keys(MOOD_MAP).find(m=>n.includes(m));if(mood)return`${MOOD_MAP[mood].generos}|${t}`;return`Ação,Comédia|${t}`;}
   
   async function fetchByGenre(t,g,p){const pg=p||Math.floor(Math.random()*3)+1;const url=`/api/tmdb?type=${t}&genreId=${g}&page=${pg}&language=${encodeURIComponent(USER_LANG)}&sort_by=popularity.desc`;const d=await fetchJSON(url,{}, {clearCache:true});return rerank(qualityFilter(d.results||[])).slice(0,MAX_PER_GENRE);}
   function qualityFilter(l){return l.filter(x=>{const y=parseYear(x);return x.poster_path&&x.vote_average>=MIN_VOTE_AVG&&(x.vote_count||0)>=MIN_VOTE_COUNT&&(y===0||y>=MIN_YEAR);});}
   function rerank(i){return[...i].sort(()=>Math.random()-0.5);}
   
   /* ======================================================
      6) PESQUISA PRINCIPAL
      ====================================================== */
   let lastQuery=null,currentType='movie',currentPage=1;
   async function search(t=null,{append=false}={}){const input=(t??searchInput.value).trim();if(!input&&!append)return;if(!append){resultsContainer.innerHTML=`<div class='loading-container'><div class='spinner'></div><span>Carregando…</span></div>`;}
   const ai=await askAI(input);let[genRaw,typeRaw]=(ai||'').split('|').map(s=>(s||'').trim());let generos=(genRaw||"").split(',').map(g=>g.trim()).filter(Boolean);const n=normalize(input);const saidSerie=n.includes('série')||n.includes('serie');const isGenre=allMovieGenreKeysNorm.some(k=>n.includes(k));let type='movie';if(saidSerie&&!isGenre)type='tv';else if(typeRaw)type=(typeRaw.toLowerCase().includes('série')||typeRaw.toLowerCase().includes('serie'))?'tv':'movie';
   if(!generos.length){const keys=Object.keys(movieGenresNorm);const found=keys.find(k=>n.includes(k));generos=[found?Object.keys(movieGenres).find(K=>normalize(K)===found)||found:"Ação"];}
   lastQuery=input;currentType=type;
   let results=[];for(const g of generos){const gid=movieGenresNorm[normalize(g)]||tvGenresNorm[normalize(g)];if(!gid)continue;try{const items=await fetchByGenre(type,gid);results.push(...items);}catch(e){console.warn(e);}}
   const unique=uniqById(results);
   resultsContainer.innerHTML="";unique.forEach(it=>resultsContainer.appendChild(createCard(it,type)));
   resultsTitle.textContent=`Resultados (${unique.length})`;window.scrollTo({top:resultsContainer.offsetTop-70,behavior:'smooth'});}
   
   /* ======================================================
      7) EVENTOS / BOTÕES
      ====================================================== */
   searchButton?.addEventListener('click',()=>search());
   searchInput?.addEventListener('keyup',e=>{if(e.key==='Enter')search();});
   surpriseButton?.addEventListener('click',()=>{const arr=Object.keys(movieGenres);const g=arr[Math.floor(Math.random()*arr.length)];search(g);});
   
   /* ======================================================
      8) TRAILER / MODAL
      ====================================================== */
   function openTrailer(k){const m=document.getElementById('trailer-modal');const i=document.getElementById('trailer-video');if(!m||!i)return;i.src=`https://www.youtube.com/embed/${k}?autoplay=1`;m.style.display='flex';}
   function closeTrailer(){const m=document.getElementById('trailer-modal');const i=document.getElementById('trailer-video');if(!m||!i)return;i.src='';m.style.display='none';}
   document.getElementById('close-modal')?.addEventListener('click',closeTrailer);
   document.getElementById('trailer-modal')?.addEventListener('click',e=>{if(e.target.id==='trailer-modal')closeTrailer();});
   async function fetchTrailer(id,t,desc){try{let d=await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${t}&lang=pt-BR`,{},{});if(!(d&&d.key))d=await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${t}&lang=en-US`,{},{});if(d&&d.key)openTrailer(d.key);else speak(desc);}catch{speak(desc);}}
   
   /* ======================================================
      9) AVALIAÇÕES / REVIEW
      ====================================================== */
   function initReviews(){if(!starRatingWrap||!enviarAvaliacaoBtn||!avaliacoesLista)return;let sel=0;const stars=Array.from(starRatingWrap.querySelectorAll('span[data-value]'));stars.forEach(star=>{star.addEventListener('click',()=>{sel=+star.dataset.value;stars.forEach(s=>s.classList.toggle('selected',+s.dataset.value<=sel));});});
   enviarAvaliacaoBtn.addEventListener('click',()=>{const txt=(comentarioInput?.value||'').trim();if(!sel)return toast('Escolha uma nota','error');if(txt.length<3)return toast('Escreva um comentário','error');addReview(sel,txt);comentarioInput.value='';renderReviewsList();toast('Avaliação enviada!');});renderReviewsList();}
   function renderReviewsList(){avaliacoesLista.innerHTML='';(reviews.items||[]).forEach(r=>{const it=document.createElement('div');it.className='avaliacao-item';it.innerHTML=`<div>${'★'.repeat(clamp(r.stars||0,1,5))}</div><p>${r.text}</p>`;avaliacoesLista.appendChild(it);});}
   
   /* ======================================================
      10) BOOT
      ====================================================== */
   function boot(){initReviews();resultsTitle.textContent='Top do momento';search('Ação');}
   boot();
   
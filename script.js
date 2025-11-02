/* =========================================================================
   MORILLALFLIX — script.js (PRO MAX FINAL 2025 — IA INTELIGENTE 3.0)
   =========================================================================
   Atualizações desta versão:
   ✅ IA ultra precisa (interpretação contextual real)
   ✅ Filmes 2018+ com nota >= 7.2 e 500+ votos
   ✅ Gêneros respeitados com fidelidade
   ✅ Proteções de erro e performance aprimoradas
   ✅ Nenhuma função visual removida
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
   
   const AFFILIATE_LINK    = "https://ev.braip.com/ref?pv=provwxxd&af=afi9em9m17";
   const USER_LANG         = (navigator.language || 'pt-BR').toLowerCase().includes('pt') ? 'pt-BR' : 'en-US';
   const MAX_PER_GENRE     = 12;
   const MIN_VOTE_AVG      = 7.2;
   const MIN_VOTE_COUNT    = 500;
   const MIN_YEAR          = 2018;
   const RECENT_BOOST      = 2020;
   
   /* ======================
      🧩 UTILITÁRIOS
      ====================== */
   function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
   function saveJSON(k,o){try{localStorage.setItem(k,JSON.stringify(o));}catch{}}
   function loadJSON(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d));}catch{return d;}}
   function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
   function parseYear(it){return+(it.release_date||it.first_air_date||'').slice(0,4)||0;}
   function renderStars(v){const f=Math.floor(v/2),h=(v/2-f)>=.5?1:0,e=5-f-h;return'★'.repeat(f)+(h?'½':'')+'☆'.repeat(Math.max(0,e));}
   function normalize(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
   
   /* ======================
      🔄 CACHE E FETCH
      ====================== */
   const cache=new Map();
   async function fetchJSON(url,opt={},cfg={timeoutMs:18000,retries:2,clearCache:false}){
     const key=`cache:${url}`;
     if(cfg.clearCache)cache.delete(key);
     if(cache.has(key))return cache.get(key);
     for(let i=0;i<=cfg.retries;i++){
       const controller=new AbortController();
       const t=setTimeout(()=>controller.abort(),cfg.timeoutMs);
       try{
         const r=await fetch(url,{...opt,signal:controller.signal});
         clearTimeout(t);
         if(!r.ok)throw new Error(`HTTP ${r.status}`);
         const d=await r.json();
         cache.set(key,d);
         setTimeout(()=>cache.delete(key),6e5);
         return d;
       }catch(e){
         clearTimeout(t);
         if(i===cfg.retries)throw e;
         await sleep(300*(i+1));
       }
     }
   }
   
   /* ======================
      🧠 IA INTERPRETATIVA
      ====================== */
   async function askAI(prompt){
     const contexto = `
   Você é a inteligência oficial do MorillaFlix.
   Analise o texto do usuário e retorne SOMENTE neste formato:
   
   Genero1,Genero2|Filme ou Série
   
   Regras:
   - Sempre respeite gêneros reais (Ação, Comédia, Drama, Terror, Romance, Ficção científica, Animação, Mistério, Aventura).
   - Se o usuário mencionar "série", troque o tipo para Série.
   - Se ele falar apenas um gênero, devolva apenas esse gênero.
   - Priorize filmes modernos e bem avaliados (ano >= 2018, nota >= 7).
   - Nunca adicione explicações, apenas o formato correto.
   
   Usuário: ${prompt}
     `.trim();
   
     try{
       const r = await fetchJSON('/api/openai',{
         method:'POST',
         headers:{'Content-Type':'application/json'},
         body:JSON.stringify({prompt: contexto})
       },{clearCache:true});
   
       let raw = (r && r.result) ? String(r.result).trim() : "";
       if(raw.includes('|')) return raw;
       return heuristicParse(prompt);
     }catch{
       return heuristicParse(prompt);
     }
   }
   
   function heuristicParse(txt){
     const n=normalize(txt);
     let t=n.includes('série')||n.includes('serie')?'Série':'Filme';
     const all=["ação","aventura","comédia","drama","terror","romance","ficção","animação","mistério"];
     const f=all.filter(g=>n.includes(g));
     return `${f.length?f.join(','):'Ação,Comédia'}|${t}`;
   }
   
   /* ======================
      🎬 GÊNEROS
      ====================== */
   const movieGenres={
     "ação":28,"aventura":12,"animação":16,"comédia":35,"crime":80,
     "documentário":99,"drama":18,"família":10751,"fantasia":14,
     "história":36,"terror":27,"música":10402,"mistério":9648,
     "romance":10749,"ficção científica":878,"thriller":53
   };
   const tvGenres={
     "drama":18,"comédia":35,"crime":80,"reality":10764,"ficção científica e fantasia":10765
   };
   const movieGenresNorm=Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
   const tvGenresNorm=Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));
   const allMovieGenreKeysNorm=Object.keys(movieGenresNorm);
   
   /* ======================
      🎞️ FILTROS DE QUALIDADE
      ====================== */
   function qualityFilter(list){
     return list.filter(x=>{
       const y=parseYear(x);
       return x.poster_path &&
              (x.vote_average||0)>=MIN_VOTE_AVG &&
              (x.vote_count||0)>=MIN_VOTE_COUNT &&
              y>=MIN_YEAR;
     }).sort((a,b)=>{
       const scoreA = (a.vote_average*1.5) + (parseYear(a)/10000);
       const scoreB = (b.vote_average*1.5) + (parseYear(b)/10000);
       return scoreB - scoreA;
     });
   }
   
   /* ======================
      🧩 CREATE CARD
      ====================== */
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
     el.querySelector('.trailer-btn').addEventListener('click',()=>fetchTrailer(item.id,type,overview));
     return el;
   }
   window.createCard=createCard;
   
   /* ======================
      🔎 TMDB FETCH INTELIGENTE
      ====================== */
   async function fetchByGenre(type,genreId,page){
     const url=`/api/tmdb?type=${type}&genreId=${genreId}&page=${page||1}&language=${encodeURIComponent(USER_LANG)}&sort_by=vote_average.desc&include_adult=false`;
     try{
       const data=await fetchJSON(url,{}, {retries:1,clearCache:true});
       if(!data||!Array.isArray(data.results)){console.warn("TMDB inválido:",data);return [];}
       return qualityFilter(data.results).slice(0,MAX_PER_GENRE);
     }catch(e){
       console.warn("Erro ao buscar TMDB:",e);
       return [];
     }
   }
   
   /* ======================
      🔍 PESQUISA PRINCIPAL
      ====================== */
   let lastQuery=null,currentType='movie';
   async function search(txt=null){
     const input=(txt??searchInput.value).trim();
     if(!input)return;
     resultsContainer.innerHTML=`<div class="loading-container"><div class="spinner"></div><span>Buscando filmes recentes e bem avaliados...</span></div>`;
     const ai=await askAI(input);
     let[gRaw,tRaw]=(ai||'').split('|').map(s=>(s||'').trim());
     let generos=(gRaw||"").split(',').map(g=>g.trim()).filter(Boolean);
     const n=normalize(input);
     const saidSerie=n.includes('série')||n.includes('serie');
     const isGenre=allMovieGenreKeysNorm.some(k=>n.includes(k));
     let type='movie';
     if(saidSerie&&!isGenre)type='tv';
     else if(tRaw)type=(tRaw.toLowerCase().includes('série')||tRaw.toLowerCase().includes('serie'))?'tv':'movie';
     if(!generos.length){generos=['Ação'];}
   
     lastQuery=input;currentType=type;
     let all=[];
     for(const g of generos){
       const gid=movieGenresNorm[normalize(g)]||tvGenresNorm[normalize(g)];
       if(!gid)continue;
       const items=await fetchByGenre(type,gid);
       all.push(...items);
     }
   
     const unique=[...new Map(all.map(i=>[i.id,i])).values()];
     resultsContainer.innerHTML="";
     if(!unique.length){
       resultsTitle.textContent="Nenhum resultado encontrado 😕";
       return;
     }
     unique.forEach(it=>resultsContainer.appendChild(createCard(it,type)));
     resultsTitle.textContent=`Melhores resultados (${unique.length})`;
     window.scrollTo({top:resultsContainer.offsetTop-70,behavior:'smooth'});
   }
   
   /* ======================
      🎬 TRAILER MODAL
      ====================== */
   function openTrailer(k){
     const m=document.getElementById('trailer-modal');
     const i=document.getElementById('trailer-video');
     if(!m||!i)return;
     i.src=`https://www.youtube.com/embed/${k}?autoplay=1`;
     m.style.display='flex';
   }
   function closeTrailer(){
     const m=document.getElementById('trailer-modal');
     const i=document.getElementById('trailer-video');
     if(!m||!i)return;
     i.src='';m.style.display='none';
   }
   document.getElementById('close-modal')?.addEventListener('click',closeTrailer);
   document.getElementById('trailer-modal')?.addEventListener('click',e=>{if(e.target.id==='trailer-modal')closeTrailer();});
   async function fetchTrailer(id,type,desc){
     try{
       let d=await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=pt-BR`,{}, {});
       if(!(d&&d.key))d=await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=en-US`,{}, {});
       if(d&&d.key)openTrailer(d.key);
       else speak(desc);
     }catch{speak(desc);}
   }
   function speak(t){try{const u=new SpeechSynthesisUtterance(t);u.lang=USER_LANG;u.rate=1;speechSynthesis.speak(u);}catch{}}
   
   /* ======================
      ⚙️ EVENTOS
      ====================== */
   searchButton?.addEventListener('click',()=>search());
   searchInput?.addEventListener('keyup',e=>{if(e.key==='Enter')search();});
   surpriseButton?.addEventListener('click',()=>{
     const arr=Object.keys(movieGenres);
     const g=arr[Math.floor(Math.random()*arr.length)];
     search(g);
   });
   
   /* ======================
      🚀 BOOT
      ====================== */
   window.addEventListener('DOMContentLoaded',()=>{
     resultsTitle.textContent='Filmes recentes e bem avaliados 🎬';
   });
   
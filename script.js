/* =========================================================================
   MORILLALFLIX — script.js (PRO MAX INTELIGENTE 4.0 — IA TOTAL)
   =========================================================================
   ✅ Compatível com /api/openai.js, /api/tmdb/index.js e /api/tmdb/trailer.js
   ✅ IA contextual (interpreta humor, gênero e emoção)
   ✅ Resultados 2018+ com nota alta e curadoria automática
   ✅ Correções de performance e UX fluida
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
   const MAX_PER_GENRE     = 10;
   const MIN_VOTE_AVG      = 7.2;
   const MIN_VOTE_COUNT    = 500;
   const MIN_YEAR          = 2018;
   
   /* ======================
      ⚙️ UTILITÁRIOS
      ====================== */
   function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
   function parseYear(it){return+(it.release_date||it.first_air_date||'').slice(0,4)||0;}
   function renderStars(v){const f=Math.floor(v/2),h=(v/2-f)>=.5?1:0,e=5-f-h;return'★'.repeat(f)+(h?'½':'')+'☆'.repeat(Math.max(0,e));}
   function normalize(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
   
   /* ======================
      💾 CACHE LOCAL
      ====================== */
   const cache=new Map();
   async function fetchJSON(url,opt={},cfg={timeoutMs:15000,retries:1,clearCache:false}){
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
         await sleep(400*(i+1));
       }
     }
   }
   
   /* ======================
      🧠 OPENAI IA
      ====================== */
   async function askAI(prompt){
     try{
       const r=await fetch('/api/openai',{
         method:'POST',
         headers:{'Content-Type':'application/json'},
         body:JSON.stringify({prompt})
       });
       const data=await r.json();
       if(data?.result)return data.result;
       return heuristicParse(prompt);
     }catch(e){
       console.warn("Fallback IA → heurística local:",e);
       return heuristicParse(prompt);
     }
   }
   
   function heuristicParse(txt){
     const n=normalize(txt);
     let t=n.includes('série')||n.includes('serie')?'Série':'Filme';
     const all=["ação","aventura","comédia","drama","terror","romance","ficção","mistério","fantasia"];
     const f=all.filter(g=>n.includes(g));
     return `${f.length?f.join(','):'Ação,Drama'}|${t}`;
   }
   
   /* ======================
      🎬 GÊNEROS
      ====================== */
   const movieGenres={"ação":28,"aventura":12,"animação":16,"comédia":35,"crime":80,"drama":18,"terror":27,"romance":10749,"ficção científica":878,"mistério":9648};
   const tvGenres={"drama":18,"comédia":35,"crime":80,"reality":10764,"ficção científica e fantasia":10765};
   const movieGenresNorm=Object.fromEntries(Object.entries(movieGenres).map(([k,v])=>[normalize(k),v]));
   const tvGenresNorm=Object.fromEntries(Object.entries(tvGenres).map(([k,v])=>[normalize(k),v]));
   const allMovieGenreKeysNorm=Object.keys(movieGenresNorm);
   
   /* ======================
      🧩 CRIAÇÃO DE CARD
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
      🔍 BUSCA TMDB INTELIGENTE
      ====================== */
   async function fetchByGenre(type,genreId){
     try{
       const url=`/api/tmdb?type=${type}&genreId=${genreId}&page=1&language=${USER_LANG}&year_from=2018&vote_min=${MIN_VOTE_AVG}`;
       const data=await fetchJSON(url,{}, {retries:1,clearCache:true});
       if(!data?.results)return [];
       return data.results.slice(0,MAX_PER_GENRE);
     }catch(e){
       console.warn("Erro TMDB:",e);
       return [];
     }
   }
   
   /* ======================
      🔎 PESQUISA PRINCIPAL
      ====================== */
   async function search(txt=null){
     const input=(txt??searchInput.value).trim();
     if(!input)return;
     resultsContainer.innerHTML=`<div class="loading-container"><div class="spinner"></div><span>Carregando recomendações inteligentes...</span></div>`;
     const ai=await askAI(input);
     let[gRaw,tRaw]=(ai||'').split('|').map(s=>(s||'').trim());
     let generos=(gRaw||"").split(',').map(g=>g.trim()).filter(Boolean);
     const n=normalize(input);
     const saidSerie=n.includes('série')||n.includes('serie');
     const isGenre=allMovieGenreKeysNorm.some(k=>n.includes(k));
     let type='movie';
     if(saidSerie&&!isGenre)type='tv';else if(tRaw)type=(tRaw.toLowerCase().includes('série')||tRaw.toLowerCase().includes('serie'))?'tv':'movie';
     if(!generos.length){generos=['Ação'];}
   
     let all=[];
     for(const g of generos){
       const gid=movieGenresNorm[normalize(g)]||tvGenresNorm[normalize(g)];
       if(!gid)continue;
       const items=await fetchByGenre(type,gid);
       all.push(...items);
     }
   
     const unique=[...new Map(all.map(i=>[i.id,i])).values()];
     resultsContainer.innerHTML="";
     if(!unique.length){resultsTitle.textContent="Nenhum resultado encontrado 😕";return;}
     unique.forEach(it=>resultsContainer.appendChild(createCard(it,type)));
     resultsTitle.textContent=`Resultados (${unique.length}) — ${generos.join(', ')}`;
     window.scrollTo({top:resultsContainer.offsetTop-70,behavior:'smooth'});
   }
   
   /* ======================
      🎞️ TRAILER MODAL
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
       let d=await fetchJSON(`/api/tmdb/trailer?id=${id}&type=${type}&lang=${USER_LANG}`,{}, {});
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
      🚀 INICIALIZAÇÃO
      ====================== */
   window.addEventListener('DOMContentLoaded',()=>{
     resultsTitle.textContent='Filmes e séries recomendados 🔥';
   });
   
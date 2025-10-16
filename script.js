const featuredBanner = document.getElementById('featured-banner');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const surpriseButton = document.getElementById('surprise-button');
const resultsContainer = document.getElementById('results');

const movieGenres = { "Ação":28, "Comédia":35, "Drama":18, "Terror":27, "Romance":10749, "Aventura":12, "Ficção científica":878, "Animação":16 };
const tvGenres = { "Ação":10759, "Comédia":35, "Drama":18, "Terror":9648, "Romance":10749, "Aventura":10759, "Ficção científica":10765, "Animação":16 };

function normalize(str){ return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

const movieGenresNormalized = {};
for(const key in movieGenres){ movieGenresNormalized[normalize(key)] = movieGenres[key]; }
const tvGenresNormalized = {};
for(const key in tvGenres){ tvGenresNormalized[normalize(key)] = tvGenres[key]; }

function renderStars(vote){
    const full = Math.floor(vote/2);
    const half = vote%2>=1?1:0;
    const empty = 5-full-half;
    return '★'.repeat(full)+'½'.repeat(half)+'☆'.repeat(empty);
}

function createCard(item,type){
    const card = document.createElement('div');
    card.classList.add('card');

    const title = item.title || item.name || "Sem título";
    let overview = item.overview || "Sem sinopse disponível";
    if(window.innerWidth <= 768 && overview.length>120) overview = overview.slice(0,120) + "...";

    const rating = item.vote_average || 0;
    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null;

    card.innerHTML = `
        <div class="poster">${poster?`<img src="${poster}" alt="${title}">`:`<div class="no-image">Sem imagem</div>`}</div>
        <div class="card-info">
            <h3>${title}</h3>
            <p class="type">${type==='movie'?'Filme':'Série'}</p>
            <p class="overview">${overview}</p>
            <button class="toggle-overview">Leia mais</button>
            <p class="rating">Nota: <span class="stars">${renderStars(rating)}</span></p>
        </div>
    `;

    const toggleBtn = card.querySelector('.toggle-overview');
    const overviewP = card.querySelector('.overview');
    overviewP.style.maxHeight = "80px";
    overviewP.style.overflow = "hidden";
    toggleBtn.addEventListener('click', ()=>{
        if(toggleBtn.innerText==="Leia mais"){
            overviewP.style.maxHeight="500px";
            toggleBtn.innerText="Leia menos";
        } else {
            overviewP.style.maxHeight="80px";
            toggleBtn.innerText="Leia mais";
        }
    });

    return card;
}

async function fetchByGenre(type, genreId){
    const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&language=pt-BR&page=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results;
}

// Função para chamar OpenAI
async function enviarParaOpenAI(prompt) {
    const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    return data.resposta;
}

// Função de busca adaptada com IA
async function search(){
    const inputOriginal = searchInput.value.trim();
    const input = normalize(inputOriginal);
    let type, genreId;

    if(movieGenresNormalized[input]){
        type='movie'; genreId = movieGenresNormalized[input];
    } else if(tvGenresNormalized[input]){
        type='tv'; genreId = tvGenresNormalized[input];
    } else {
        // Se não achar, chama OpenAI para sugerir um gênero válido
        const prompt = `Dado o termo "${inputOriginal}", sugira um gênero de filme ou série existente em português (ex: Ação, Comédia, Drama, Terror, Romance, Aventura, Ficção científica, Animação)`;
        const sugestao = await enviarParaOpenAI(prompt);
        const novoInput = normalize(sugestao.split(/,|\n/)[0].trim());
        if(movieGenresNormalized[novoInput]){
            type='movie'; genreId = movieGenresNormalized[novoInput];
        } else if(tvGenresNormalized[novoInput]){
            type='tv'; genreId = tvGenresNormalized[novoInput];
        } else {
            alert("Gênero não encontrado!");
            return;
        }
    }

    resultsContainer.innerHTML = '';
    const results = await fetchByGenre(type, genreId);
    results.forEach(item => resultsContainer.appendChild(createCard(item,type)));
}

// Surpresa
async function surprise(){
    const genres = Object.keys(movieGenres);
    const randomGenre = genres[Math.floor(Math.random()*genres.length)];
    searchInput.value = randomGenre;
    await search();
}

searchButton.addEventListener('click', search);
searchInput.addEventListener('keyup', e=>{ if(e.key==='Enter') search(); });
surpriseButton.addEventListener('click', surprise);

// Banner
async function loadFeatured(){
    const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`;
    const res = await fetch(url);
    const data = await res.json();
    const movies = data.results.slice(0,5);

    movies.forEach((movie,index)=>{
        const slide = document.createElement('div');
        slide.classList.add('featured-slide');
        if(index===0) slide.classList.add('active');
        slide.innerHTML = `<img src="https://image.tmdb.org/t/p/original${movie.backdrop_path}" alt="${movie.title}">
            <div class="featured-info">
                <h2>${movie.title}</h2>
                <p>${movie.overview||"Sem sinopse disponível"}</p>
                <p>Nota: ${renderStars(movie.vote_average)}</p>
            </div>
        `;
        featuredBanner.appendChild(slide);
    });

    let current = 0;
    setInterval(()=>{
        const slides = document.querySelectorAll('.featured-slide');
        slides[current].classList.remove('active');
        current = (current+1)%slides.length;
        slides[current].classList.add('active');
    },5000);
}

loadFeatured();

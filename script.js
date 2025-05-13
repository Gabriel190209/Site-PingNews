const socket = io.connect(window.location.origin);
const caixa = document.getElementById("caixa_branca");
const carregando = document.getElementById("tela_carregando");
const searchInput = document.getElementById("searchInput");

let noticiasExibidas = new Set();

function normalizarTexto(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

let noticiasSalvas = JSON.parse(localStorage.getItem("noticias")) || [];

function exibirNoticia(noticia, noTopo = false) {
    const idNoticia = noticia.titulo + noticia.fonte;
    if (noticiasExibidas.has(idNoticia)) return;

    const div = document.createElement("div");
    div.className = "noticia";
    div.innerHTML = `
        <h3>${noticia.titulo}</h3>
        <p>${noticia.resumo}</p>
        <span class="fonte">${noticia.fonte}</span>
    `;
    if (noTopo) {
        caixa.insertBefore(div, caixa.firstChild);
    } else {
        caixa.appendChild(div);
    }
    noticiasExibidas.add(idNoticia);
}

noticiasSalvas.forEach(noticia => exibirNoticia(noticia));

searchInput.addEventListener("input", () => {
    const termo = normalizarTexto(searchInput.value);
    caixa.innerHTML = "";
    noticiasExibidas.clear();
    noticiasSalvas
        .filter(n => normalizarTexto(n.fonte).includes(termo))
        .forEach(n => exibirNoticia(n));
});

socket.on("nova_noticia", (noticia) => {
    exibirNoticia(noticia, true);
    noticiasSalvas.unshift(noticia);
    localStorage.setItem("noticias", JSON.stringify(noticiasSalvas));
});

fetch(window.location.origin + "/noticias")
    .then(resp => resp.json())
    .then(data => {
        carregando.style.display = "none";
        data.forEach(noticia => {
            exibirNoticia(noticia, true);
            noticiasSalvas.unshift(noticia);
        });
        localStorage.setItem("noticias", JSON.stringify(noticiasSalvas));
    })
    .catch(err => {
        carregando.innerHTML = "<p>Erro ao carregar notícias.</p>";
        console.error(err);
    });

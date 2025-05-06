window.addEventListener("DOMContentLoaded", () => {
  const tela = document.getElementById("tela_carregando");
  const conteudo = document.getElementById("conteudo");
  const caixa = document.getElementById("caixaNoticias");
  const inputPesquisa = document.getElementById("pesquisa");

  conteudo.style.display = "block";
  tela.style.opacity = "0";

  setTimeout(() => {
    tela.style.display = "none";

    fetch("http://127.0.0.1:5000/noticias")
      .then(res => {
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        return res.json();
      })
      .then(novasNoticias => {
        console.log("Novas notícias recebidas:", novasNoticias);

        // Recupera do localStorage todas as notícias antigas (objetos completos)
        const noticiasAntigas = JSON.parse(localStorage.getItem("noticiasVistas")) || [];

        // Conjunto com chave única de cada notícia existente (evita repetição)
        const chavesAntigas = new Set(
          noticiasAntigas.map(n => `${n.titulo}-${n.fonte}-${n.resumo}`)
        );

        // Filtra as novas que ainda não foram vistas
        const novasUnicas = novasNoticias.filter(nova => {
          const chave = `${nova.titulo}-${nova.fonte}-${nova.resumo}`;
          if (chavesAntigas.has(chave)) return false;
          chavesAntigas.add(chave);
          return true;
        });

        // Junta as novas com as antigas e salva no localStorage
        const todasAsNoticias = [...novasUnicas, ...noticiasAntigas];
        localStorage.setItem("noticiasVistas", JSON.stringify(todasAsNoticias));

        // Exibe tudo (ordenado com novas no topo)
        exibirNoticias(todasAsNoticias);

        // Aplica filtro de pesquisa atual
        aplicarFiltro(inputPesquisa.value.trim().toLowerCase());
      })
      .catch(err => {
        console.error("Erro ao buscar notícias:", err);
      });
  }, 2000);

  inputPesquisa.addEventListener("input", () => {
    aplicarFiltro(inputPesquisa.value.trim().toLowerCase());
  });

  function exibirNoticias(noticias) {
    caixa.innerHTML = "";
    noticias.forEach(noticia => {
      const bloco = document.createElement("div");
      bloco.className = "noticia";
      bloco.innerHTML = `
        <h3>${noticia.titulo}</h3>
        <p><strong>${noticia.fonte}</strong></p>
        <ul>${noticia.resumo
          .split('\n')
          .map(item => `<li>${item}</li>`)
          .join('')}</ul>
      `;
      caixa.appendChild(bloco);
    });
  }

  function aplicarFiltro(termo) {
    const noticias = document.querySelectorAll(".noticia");
    const fontesValidas = {
      "cnn": "cnn brasil",
      "g1": "g1",
      "globo": "globo",
      "uol": "uol"
    };

    const termoNormalizado = termo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    noticias.forEach(noticia => {
      const fonte = noticia.querySelector("p strong")?.textContent
        ?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || "";

      if (
        termoNormalizado === "" ||
        fonte.includes(fontesValidas[termoNormalizado] || "")
      ) {
        noticia.style.display = "block";
      } else {
        noticia.style.display = "none";
      }
    });
  }
});

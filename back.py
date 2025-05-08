from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from bs4 import BeautifulSoup
import requests
from transformers import pipeline
from dotenv import load_dotenv
import sqlite3
import os
import threading
import time

port = int(os.environ.get("PORT", 5000))

load_dotenv()

resumidor = pipeline("summarization", model="facebook/bart-large-cnn")

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, async_mode="eventlet")

news_sites = {
    "G1": "https://g1.globo.com",
    "CNN Brasil": "https://www.cnnbrasil.com.br",
    "UOL": "https://noticias.uol.com.br",
    "Globo": "https://globo.com"
}

def buscar_links(site_url, max_links=3):
    try:
        response = requests.get(site_url, timeout=5)
        soup = BeautifulSoup(response.content, "html.parser")
        links = [a['href'] for a in soup.find_all('a', href=True)]

        links_validos = [
            link for link in links
            if link.startswith("http")
            and site_url.split("//")[1] in link
            and "utm_" not in link
            and "#" not in link
            and len(link.split("/")) > 4
        ]

        return list(dict.fromkeys(links_validos))[:max_links]
    except Exception as e:
        print(f"Erro ao buscar links: {e}")
        return []

def extrair_titulo_e_texto(link):
    try:
        response = requests.get(link, timeout=5)
        soup = BeautifulSoup(response.content, "html.parser")

        titulo = soup.title.string.strip() if soup.title and soup.title.string else "Sem título"
        paragrafos = soup.find_all('p')
        texto = " ".join(p.get_text() for p in paragrafos)
        return titulo, texto.strip()[:1024]
    except Exception as e:
        print(f"Erro ao extrair conteúdo de {link}: {e}")
        return "Sem título", None

def resumir_com_modelo(texto):
    try:
        print("🔍 Resumindo com modelo local...")
        resumo_raw = resumidor(texto, max_length=130, min_length=30, do_sample=False)
        resumo = resumo_raw[0]['summary_text']
        print("✅ Resumo:", resumo[:200])
        return resumo
    except Exception as e:
        print("❌ Erro ao resumir:", e)
        return "Resumo indisponível."

def salvar_noticia(fonte, titulo, resumo):
    conn = sqlite3.connect("noticias.db")
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT OR IGNORE INTO noticias (fonte, titulo, resumo) VALUES (?, ?, ?)",
                       (fonte, titulo, resumo))
        conn.commit()
    except Exception as e:
        print(f"Erro ao salvar: {e}")
    finally:
        conn.close()

def carregar_noticias():
    conn = sqlite3.connect("noticias.db")
    cursor = conn.cursor()
    cursor.execute("SELECT fonte, titulo, resumo FROM noticias ORDER BY id DESC")
    resultados = [{"fonte": fonte, "titulo": titulo, "resumo": resumo} for fonte, titulo, resumo in cursor.fetchall()]
    conn.close()
    return resultados

def processar_noticias():
    while True:
        for nome_site, url_base in news_sites.items():
            links = buscar_links(url_base)
            for link in links:
                titulo, texto = extrair_titulo_e_texto(link)
                if texto and len(texto) > 200:
                    resumo = resumir_com_modelo(texto)
                    salvar_noticia(nome_site, titulo, resumo)
                    socketio.emit('nova_noticia', {'fonte': nome_site, 'titulo': titulo, 'resumo': resumo})
        print("⏳ Aguardando 5 minutos para nova verificação...")
        time.sleep(100)

@app.route('/noticias')
def get_noticias():
    conn = sqlite3.connect('noticias.db')
    cursor = conn.cursor()

    cursor.execute("SELECT titulo, fonte, resumo FROM noticias ORDER BY id DESC")
    noticias = cursor.fetchall()
    conn.close()

    vistas = set()
    unicas = []
    for titulo, fonte, resumo in noticias:
        chave = f"{titulo}-{resumo}"
        if chave in vistas:
            continue
        vistas.add(chave)
        unicas.append({
            "titulo": titulo,
            "fonte": fonte,
            "resumo": resumo
        })

    return jsonify(unicas)


@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

@socketio.on('connect')
def handle_connect():
    print("Cliente conectado.")

@socketio.on('disconnect')
def handle_disconnect():
    print("Cliente desconectado.")

if __name__ == "__main__":
    threading.Thread(target=processar_noticias, daemon=True).start()
    socketio.run(app, debug=False, host="0.0.0.0", port=port)
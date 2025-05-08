import sqlite3

conn = sqlite3.connect("noticias.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS noticias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fonte TEXT,
    titulo TEXT UNIQUE,
    resumo TEXT
)
""")

conn.commit()
conn.close()

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- rotas de API (mantém as tuas /depositar, /levantar, /saldo/:conta aqui em cima) ---

// >>> SERVIR FRONTEND <<<
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const INDEX_HTML = path.join(FRONTEND_DIR, "index.html");

// Log de diagnóstico
console.log("FRONTEND_DIR:", FRONTEND_DIR);
console.log("INDEX_HTML existe?", fs.existsSync(INDEX_HTML));

// servir ficheiros estáticos (app.js, styles.css, imagens, etc.)
app.use(express.static(FRONTEND_DIR));

// rota raiz: envia o index.html
app.get("/", (_req, res) => {
  if (!fs.existsSync(INDEX_HTML)) {
    return res
      .status(500)
      .send("index.html não encontrado em " + INDEX_HTML);
  }
  res.sendFile(INDEX_HTML);
});

// fallback opcional para outras rotas do frontend
app.get(/.*/, (_req, res) => res.sendFile(INDEX_HTML));

app.listen(PORT, () => {
  console.log(`✅ Servidor a correr em http://localhost:${PORT}`);
});

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Caminho da BD (em backend/data/banco.db)
const dbPath = path.resolve(__dirname, "data", "banco.db");
const db = new sqlite3.Database(dbPath);

// Criação automática das tabelas e conta inicial
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal')),
    amount REAL NOT NULL CHECK (amount > 0),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  )`);

  // cria conta inicial se não existir
  db.get("SELECT COUNT(*) AS c FROM accounts", (err, row) => {
    if (row && row.c === 0) {
      db.run("INSERT INTO accounts (name) VALUES (?)", ["Conta Principal"]);
    }
  });
});

// Função para aplicar SQL externo (views/triggers)
function applySQL(file) {
  const filePath = path.resolve(__dirname, "db", file);
  if (!fs.existsSync(filePath)) return;
  const sql = fs.readFileSync(filePath, "utf8");
  db.exec(sql, (err) => {
    if (err) console.error(`Erro a aplicar ${file}:`, err.message);
    else console.log(`✔ ${file} aplicado`);
  });
}

// Aplica views e triggers ao arrancar
applySQL("views.sql");
applySQL("triggers.sql");

// ------------------ ENDPOINTS ------------------

// Saldo
app.get("/accounts/:id/balance", (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT COALESCE(SUM(CASE type WHEN 'deposit' THEN amount ELSE -amount END),0) AS balance
     FROM transactions WHERE account_id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ account_id: Number(id), balance: Number(row?.balance || 0) });
    }
  );
});

// Histórico
app.get("/accounts/:id/transactions", (req, res) => {
  const { id } = req.params;
  db.all(
    "SELECT * FROM transactions WHERE account_id = ? ORDER BY datetime(created_at) DESC",
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Depósito
app.post("/accounts/:id/deposit", (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valor inválido" });

  db.run(
    "INSERT INTO transactions (account_id, type, amount, description) VALUES (?, 'deposit', ?, ?)",
    [id, amount, description || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Depósito efetuado", transaction_id: this.lastID });
    }
  );
});

// Levantamento
app.post("/accounts/:id/withdrawal", (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valor inválido" });

  db.get(
    `SELECT COALESCE(SUM(CASE type WHEN 'deposit' THEN amount ELSE -amount END),0) AS balance
     FROM transactions WHERE account_id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row.balance < amount) return res.status(400).json({ error: "Saldo insuficiente" });

      db.run(
        "INSERT INTO transactions (account_id, type, amount, description) VALUES (?, 'withdrawal', ?, ?)",
        [id, amount, description || ""],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Levantamento efetuado", transaction_id: this.lastID });
        }
      );
    }
  );
});

// Healthcheck
app.get("/health", (req, res) => res.json({ ok: true }));

// ------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor ativo em http://localhost:${PORT}`);
});

-- =========================================
-- VIEWS ÚTEIS PARA A CONTA BANCÁRIA (SQLite)
-- Depende das tabelas: accounts, transactions
-- =========================================

-- 1) Saldo por conta (ledger: depósitos - levantamentos)
DROP VIEW IF EXISTS account_balances;
CREATE VIEW account_balances AS
SELECT
  a.id   AS account_id,
  a.name AS account_name,
  COALESCE(SUM(
    CASE t.type WHEN 'deposit' THEN t.amount ELSE -t.amount END
  ), 0)   AS balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.name;

-- 2) Extrato “pronto” por conta (linha a linha + saldo acumulado)
--    OBS: SQLite não tem janela diretamente em VIEW.
--    Mantemos o extrato base; o saldo acumulado calculas no backend (ou via CTE na query).
DROP VIEW IF EXISTS account_statement;
CREATE VIEW account_statement AS
SELECT
  t.id,
  t.account_id,
  t.created_at   AS date,
  t.type,
  t.amount,
  COALESCE(t.description,'') AS description
FROM transactions t
ORDER BY datetime(t.created_at) DESC;

-- 3) Totais diários por conta
DROP VIEW IF EXISTS daily_totals;
CREATE VIEW daily_totals AS
SELECT
  t.account_id,
  DATE(t.created_at) AS day,
  SUM(CASE WHEN t.type='deposit'    THEN t.amount ELSE 0 END) AS total_deposits,
  SUM(CASE WHEN t.type='withdrawal' THEN t.amount ELSE 0 END) AS total_withdrawals,
  SUM(CASE WHEN t.type='deposit' THEN t.amount ELSE -t.amount END) AS net_total
FROM transactions t
GROUP BY t.account_id, DATE(t.created_at);

-- 4) Totais mensais por conta (YYYY-MM)
DROP VIEW IF EXISTS monthly_totals;
CREATE VIEW monthly_totals AS
SELECT
  t.account_id,
  STRFTIME('%Y-%m', t.created_at) AS year_month,
  SUM(CASE WHEN t.type='deposit'    THEN t.amount ELSE 0 END) AS total_deposits,
  SUM(CASE WHEN t.type='withdrawal' THEN t.amount ELSE 0 END) AS total_withdrawals,
  SUM(CASE WHEN t.type='deposit' THEN t.amount ELSE -t.amount END) AS net_total
FROM transactions t
GROUP BY t.account_id, STRFTIME('%Y-%m', t.created_at);

-- 5) Últimas N transações por conta (a view traz ordenado; o "N" decides na query)
DROP VIEW IF EXISTS last_transactions;
CREATE VIEW last_transactions AS
SELECT
  t.account_id,
  t.id,
  t.created_at AS date,
  t.type,
  t.amount,
  COALESCE(t.description,'') AS description
FROM transactions t
ORDER BY datetime(t.created_at) DESC, t.id DESC;

-- 6) Saldos + totais do dia corrente (útil para dashboard)
DROP VIEW IF EXISTS today_snapshot;
CREATE VIEW today_snapshot AS
WITH today AS (
  SELECT * FROM transactions WHERE DATE(created_at) = DATE('now','localtime')
)
SELECT
  a.id AS account_id,
  a.name AS account_name,
  -- saldo geral (até agora)
  (SELECT COALESCE(SUM(CASE type WHEN 'deposit' THEN amount ELSE -amount END),0)
     FROM transactions t WHERE t.account_id = a.id) AS balance,
  -- totais de hoje
  (SELECT COALESCE(SUM(amount),0) FROM today WHERE account_id=a.id AND type='deposit')    AS today_deposits,
  (SELECT COALESCE(SUM(amount),0) FROM today WHERE account_id=a.id AND type='withdrawal') AS today_withdrawals
FROM accounts a;

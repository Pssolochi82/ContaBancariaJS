PRAGMA foreign_keys = ON;

.print '--- DEFINIR VIEWS (inline) ---'
DROP VIEW IF EXISTS account_balances;
CREATE VIEW account_balances AS
SELECT
  a.id   AS account_id,
  a.name AS account_name,
  COALESCE(SUM(CASE t.type WHEN 'deposit' THEN t.amount ELSE -t.amount END),0) AS balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.name;

DROP VIEW IF EXISTS account_statement;
CREATE VIEW account_statement AS
SELECT
  t.id,
  t.account_id,
  t.created_at AS date,
  t.type,
  t.amount,
  COALESCE(t.description,'') AS description
FROM transactions t
ORDER BY datetime(t.created_at) DESC;

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

DROP VIEW IF EXISTS today_snapshot;
CREATE VIEW today_snapshot AS
WITH today AS (
  SELECT * FROM transactions WHERE DATE(created_at) = DATE('now','localtime')
)
SELECT
  a.id AS account_id,
  a.name AS account_name,
  (SELECT COALESCE(SUM(CASE type WHEN 'deposit' THEN amount ELSE -amount END),0)
     FROM transactions t WHERE t.account_id = a.id) AS balance,
  (SELECT COALESCE(SUM(amount),0) FROM today WHERE account_id=a.id AND type='deposit')    AS today_deposits,
  (SELECT COALESCE(SUM(amount),0) FROM today WHERE account_id=a.id AND type='withdrawal') AS today_withdrawals
FROM accounts a;

.print '--- RESET (apenas para testes; cuidado em prod) ---'
DELETE FROM transactions;
DELETE FROM accounts;
DELETE FROM audit_transactions;
DELETE FROM sqlite_sequence WHERE name IN ('accounts','transactions','audit_transactions');

.print '--- CRIAR CONTAS DE TESTE ---'
INSERT INTO accounts (name) VALUES ('Conta Teste A'), ('Conta Teste B');

.print '--- CHECK: contas criadas ---'
SELECT id, name, created_at FROM accounts ORDER BY id;

-- Depósitos iniciais, IDs dinâmicos
WITH a AS (SELECT id AS idA FROM accounts WHERE name='Conta Teste A'),
     b AS (SELECT id AS idB FROM accounts WHERE name='Conta Teste B')
INSERT INTO transactions (account_id, type, amount, description)
SELECT idA, 'deposit', 1000.00, 'Depósito inicial A' FROM a
UNION ALL
SELECT idB, 'deposit',  300.00, 'Depósito inicial B' FROM b;

.print '--- SALDOS DEPOIS DOS DEPOSITOS ---'
SELECT * FROM account_balances ORDER BY account_id;

.print '--- LEVANTAMENTO VÁLIDO (A) ---'
INSERT INTO transactions (account_id, type, amount, description)
SELECT id, 'withdrawal', 250.00, 'Pagamento serviço'
FROM accounts WHERE name='Conta Teste A';

.print '--- SALDO A APÓS LEVANTAMENTO ---'
SELECT * FROM account_balances WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste A');

.print '--- TENTAR LEVANTAMENTO ACIMA DO SALDO (DEVE FALHAR) ---'
SAVEPOINT t1;
  INSERT INTO transactions (account_id, type, amount, description)
  SELECT id, 'withdrawal', 9999.99, 'Tentativa indevida'
  FROM accounts WHERE name='Conta Teste B';
RELEASE t1;

.print '--- VER SALDO B (NÃO DEVE TER ALTERADO) ---'
SELECT * FROM account_balances WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste B');

.print '--- EXTRATO (ORDER DESC) ---'
SELECT * FROM account_statement
WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste A')
ORDER BY datetime(date) DESC;

.print '--- ULTIMAS TRANSACOES ---'
SELECT * FROM last_transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name IN ('Conta Teste A','Conta Teste B'))
LIMIT 10;

.print '--- TOTAIS DIARIOS E MENSAIS ---'
SELECT * FROM daily_totals
WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste A')
ORDER BY day DESC;

SELECT * FROM monthly_totals
WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste A')
ORDER BY year_month DESC;

.print '--- TESTE: BLOQUEAR UPDATE DO TIPO (DEVE FALHAR) ---'
SAVEPOINT t2;
  UPDATE transactions
     SET type = CASE type WHEN 'deposit' THEN 'withdrawal' ELSE 'deposit' END
   WHERE id = (SELECT id FROM transactions
               WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste A')
               ORDER BY id DESC LIMIT 1);
RELEASE t2;

.print '--- AUDITORIA: INSERT/DELETE REGISTADOS ---'
INSERT INTO transactions (account_id, type, amount, description)
SELECT id, 'deposit', 10.00, 'Teste auditoria' FROM accounts WHERE name='Conta Teste A';

DELETE FROM transactions
WHERE id = (SELECT id FROM transactions
            WHERE account_id=(SELECT id FROM accounts WHERE name='Conta Teste A')
            ORDER BY id DESC LIMIT 1);

SELECT action, tx_id, account_id, type, amount, description, created_at
FROM audit_transactions
ORDER BY created_at DESC, id DESC
LIMIT 10;

.print '--- SNAPSHOT DE HOJE ---'
SELECT * FROM today_snapshot ORDER BY account_id;

.print '--- TESTES CONCLUÍDOS ---'

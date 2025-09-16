-- =================================
-- TRIGGERS COMPATÍVEIS COM SQLITE
-- =================================

-- (Opcional) Tabela de auditoria
CREATE TABLE IF NOT EXISTS audit_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_id         INTEGER,
  account_id    INTEGER,
  type          TEXT,
  amount        REAL,
  description   TEXT,
  action        TEXT,                      -- 'INSERT' | 'DELETE'
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1) Impedir saldo negativo em levantamentos
DROP TRIGGER IF EXISTS trg_prevent_negative_withdrawal;
CREATE TRIGGER trg_prevent_negative_withdrawal
BEFORE INSERT ON transactions
WHEN NEW.type = 'withdrawal'
BEGIN
  SELECT
    CASE
      WHEN (
        (SELECT COALESCE(SUM(
                 CASE type WHEN 'deposit' THEN amount ELSE -amount END
               ), 0)
         FROM transactions
         WHERE account_id = NEW.account_id)
        < NEW.amount
      )
      THEN RAISE(ABORT, 'Saldo insuficiente')
    END;
END;

-- 2) Bloquear alteração de TIPO (não trocar depósito <-> levantamento)
DROP TRIGGER IF EXISTS trg_block_type_update;
CREATE TRIGGER trg_block_type_update
BEFORE UPDATE OF type ON transactions
BEGIN
  SELECT RAISE(ABORT, 'Não é permitido alterar o tipo da transação.');
END;

-- 3) Impedir apagar conta com movimentos
DROP TRIGGER IF EXISTS trg_block_delete_account_with_txs;
CREATE TRIGGER trg_block_delete_account_with_txs
BEFORE DELETE ON accounts
WHEN EXISTS (SELECT 1 FROM transactions WHERE account_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Conta não pode ser apagada: existem transações.');
END;

-- 4) Auditoria: registar INSERT/DELETE de transações
DROP TRIGGER IF EXISTS trg_audit_tx_insert;
CREATE TRIGGER trg_audit_tx_insert
AFTER INSERT ON transactions
BEGIN
  INSERT INTO audit_transactions (tx_id, account_id, type, amount, description, action)
  VALUES (NEW.id, NEW.account_id, NEW.type, NEW.amount, NEW.description, 'INSERT');
END;

DROP TRIGGER IF EXISTS trg_audit_tx_delete;
CREATE TRIGGER trg_audit_tx_delete
AFTER DELETE ON transactions
BEGIN
  INSERT INTO audit_transactions (tx_id, account_id, type, amount, description, action)
  VALUES (OLD.id, OLD.account_id, OLD.type, OLD.amount, OLD.description, 'DELETE');
END;

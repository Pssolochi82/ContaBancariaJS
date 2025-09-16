-- ================================
-- Inserir contas iniciais
-- ================================
INSERT INTO accounts (name) VALUES
  ('Conta Principal'),
  ('Conta Poupança');

-- ================================
-- Inserir transações iniciais
-- ================================
-- Depósitos
INSERT INTO transactions (account_id, type, amount, description) VALUES
  (1, 'deposit',    1000.00, 'Depósito inicial'),
  (1, 'deposit',     500.00, 'Salário'),
  (2, 'deposit',    2000.00, 'Transferência para poupança');

-- Levantamentos
INSERT INTO transactions (account_id, type, amount, description) VALUES
  (1, 'withdrawal',  200.00, 'Supermercado'),
  (1, 'withdrawal',  100.00, 'Transportes'),
  (2, 'withdrawal',  300.00, 'Compras Online');

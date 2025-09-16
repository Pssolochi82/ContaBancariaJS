@echo off
REM ====================================
REM Executa os testes funcionais no SQLite
REM ====================================

set DB_PATH=backend\data\banco.db
set SQL_TESTS=backend\db\testes_funcionais.sql

echo Running DB tests on %DB_PATH% ...
sqlite3 %DB_PATH% < %SQL_TESTS%

echo.
echo --- TESTES FINALIZADOS ---
pause


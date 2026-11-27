@echo off
REM ── Atril · lanzador para Windows ──────────────────────────────
REM Doble clic en este archivo. Arranca el servidor local y abre la app.
REM Necesita Python instalado (python.org). Deja esta ventana abierta
REM mientras uses Atril; ciérrala para apagar el servidor.
cd /d "%~dp0"
echo Iniciando Atril en http://localhost:8000 ...
start "" "http://localhost:8000/index.html"
python -m http.server 8000 2>nul || py -m http.server 8000
pause

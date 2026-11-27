#!/bin/bash
# ── Atril · lanzador para Mac y Linux ──────────────────────────
# Doble clic (Mac) o ejecútalo desde la terminal. Arranca el servidor
# local y abre la app. Deja la ventana abierta mientras uses Atril.
#
# Si al doble clic no arranca (Mac), dale permiso una vez con:
#   chmod +x iniciar-servidor-mac-linux.command
cd "$(dirname "$0")"
echo "Iniciando Atril en http://localhost:8000 ..."
( sleep 1; open "http://localhost:8000/index.html" 2>/dev/null || xdg-open "http://localhost:8000/index.html" 2>/dev/null ) &
python3 -m http.server 8000

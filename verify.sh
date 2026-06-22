#!/bin/bash
# Verificacion de la extension Lang Utils
echo "Verificando estructura de Lang Utils..."
echo ""

cd "$(dirname "$0")"
ERRORS=0

# Check manifest.json
if [ -f "manifest.json" ]; then
  echo "[OK] manifest.json existe"
  if grep -q '"manifest_version": 2' manifest.json; then
    echo "     Manifest version 2"
  else
    echo "     [ERROR] Manifest version incorrecta"
    ERRORS=$((ERRORS+1))
  fi
else
  echo "[ERROR] manifest.json falta"
  ERRORS=$((ERRORS+1))
fi

# Check main scripts
for file in background.js content.js; do
  if [ -f "$file" ]; then
    LINES=$(wc -l < "$file")
    echo "[OK] $file ($LINES lineas)"
  else
    echo "[ERROR] $file falta"
    ERRORS=$((ERRORS+1))
  fi
done

# Check popup
if [ -f "popup/popup.html" ] && [ -f "popup/popup.js" ] && [ -f "popup/popup.css" ]; then
  echo "[OK] popup/ completo"
else
  echo "[ERROR] popup/ incompleto"
  ERRORS=$((ERRORS+1))
fi

# Check options
if [ -f "options/options.html" ] && [ -f "options/options.js" ] && [ -f "options/options.css" ]; then
  echo "[OK] options/ completo"
else
  echo "[ERROR] options/ incompleto"
  ERRORS=$((ERRORS+1))
fi

# Check chatbot
if [ -f "chatbot/chatbot.html" ] && [ -f "chatbot/chatbot.js" ] && [ -f "chatbot/chatbot.css" ]; then
  echo "[OK] chatbot/ completo"
else
  echo "[ERROR] chatbot/ incompleto"
  ERRORS=$((ERRORS+1))
fi

# Check icons
if [ -f "icons/icon-48.png" ] && [ -f "icons/icon-96.png" ]; then
  echo "[OK] iconos PNG presentes"
else
  echo "[WARN] iconos PNG faltantes - ejecuta ./generate-icons.sh"
fi

echo ""
echo "=== Resumen ==="
if [ $ERRORS -eq 0 ]; then
  echo "La extension esta lista para instalar!"
  echo ""
  echo "Pasos:"
  echo "  1. Abre Firefox -> about:debugging#/runtime/this-firefox"
  echo "  2. Clic en 'Cargar complemento temporalmente...'"
  echo "  3. Selecciona el archivo manifest.json de esta carpeta"
  echo "  4. Listo! Clic derecho en cualquier texto para usar"
else
  echo "Se encontraron $ERRORS errores"
fi

echo ""
echo "Estadisticas:"
TOTAL_LINES=$(find . -name "*.js" -o -name "*.html" -o -name "*.css" | xargs wc -l 2>/dev/null | tail -1)
echo "  Total de lineas de codigo: $TOTAL_LINES"
echo "  Archivos JS: $(find . -name "*.js" | wc -l)"
echo "  Archivos HTML: $(find . -name "*.html" | wc -l)"
echo "  Archivos CSS: $(find . -name "*.css" | wc -l)"

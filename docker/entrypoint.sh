#!/bin/sh
set -e

# Injeta as variaveis de ambiente do EasyPanel no front, em tempo de execucao.
cat > /usr/share/nginx/html/env.js <<JS
window.__ENV = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}"
};
JS

echo "[entrypoint] env.js gerado para ${VITE_SUPABASE_URL:-<vazio>}"
exec "$@"

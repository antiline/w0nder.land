#!/bin/sh
# 운영(Dockerfile)과 같은 방식으로 standalone 서버를 띄운다. next build 를 먼저 실행해야 한다.
# 사용: PORT=3100 sh scripts/start-standalone.sh
set -eu
cd "$(dirname "$0")/.."
S=.next/standalone/src/w0nder-land
if [ ! -f "$S/server.js" ]; then
  echo "standalone 산출물이 없다. 먼저 next build 를 실행한다." >&2
  exit 1
fi
rm -rf "$S/.next/static" "$S/public"
mkdir -p "$S/.next"
cp -R .next/static "$S/.next/static"
cp -R public "$S/public"
# 셸이 HOSTNAME(예: Mac-mini.local)을 미리 갖고 있어도 덮어쓴다. 바인딩 주소는 BIND_HOST 로만 바꾼다.
export PORT="${PORT:-3000}" HOSTNAME="${BIND_HOST:-127.0.0.1}" NODE_ENV=production
exec node "$S/server.js"

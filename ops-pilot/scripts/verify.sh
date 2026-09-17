#!/usr/bin/env sh
set -eu

repository_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$repository_root"

./mvnw verify
docker compose config --quiet

cd web
npm ci
npm run lint
npm run format:check
npm run test
npm run build
npm run test:e2e

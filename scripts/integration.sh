#!/bin/sh
set -eu
cd /home/debian/.hermes/workspace/projects/investment-radar
name="radar_test_$(date -u +%Y%m%d%H%M%S)"
./scripts/compose.sh exec -T db createdb -U radar_owner "$name"
cleanup() { ./scripts/compose.sh exec -T db dropdb -U radar_owner "$name"; }
trap cleanup EXIT
./scripts/compose.sh run --rm -T -e TEST_DB_NAME="$name" migrate sh -c 'export TEST_DATABASE_URL="${DATABASE_URL%/*}/$TEST_DB_NAME" NODE_ENV=test; npm test'

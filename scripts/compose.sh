#!/bin/sh
set -eu
cd /home/debian/.hermes/workspace/projects/investment-radar
exec docker compose --env-file /home/debian/.hermes/.env "$@"

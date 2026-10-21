#!/bin/sh
# Repository mirror of ~/.hermes/scripts/investment_radar_worker.sh.
# Transport success means accepted result, NOT business collection health.
set -eu
cd /home/debian/.hermes/workspace/projects/investment-radar
exec python3 ./scripts/worker-notify.py -- ./scripts/worker.sh

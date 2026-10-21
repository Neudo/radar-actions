#!/bin/sh
set -eu
exec /home/debian/.hermes/workspace/projects/investment-radar/scripts/compose.sh run --rm --no-deps --quiet -T worker

#!/usr/bin/env python3
"""Real isolated PostgreSQL suite with the separately tagged preview image."""
import datetime
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
compose = str(root / 'scripts/compose.sh')
name = 'radar_test_repair_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S') + '_' + str(os.getpid())
values = {}
for line in pathlib.Path('/home/debian/.hermes/.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
environment = dict(os.environ, IR_DB_PASSWORD=values['IR_DB_PASSWORD'])
subprocess.run([compose, 'exec', '-T', 'db', 'createdb', '-U', 'radar_owner', name], check=True)
try:
    # Only the owner credential reaches this disposable TEST container; never API/Hermes secrets.
    result = subprocess.run(['docker', 'run', '--rm', '--network', 'investment-radar_backend', '-e', 'IR_DB_PASSWORD', '-e', 'TEST_DB_NAME='+name,
                             'investment-radar-worker-repair-preview', 'sh', '-c',
                             'export TEST_DATABASE_URL="postgresql://radar_owner:${IR_DB_PASSWORD}@db:5432/$TEST_DB_NAME" NODE_ENV=test; npm test'], env=environment)
finally:
    subprocess.run([compose, 'exec', '-T', 'db', 'dropdb', '-U', 'radar_owner', name], check=True)
sys.exit(result.returncode)

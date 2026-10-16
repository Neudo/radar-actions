#!/usr/bin/env python3
"""Read-only production HTTPS smoke test; never print credentials or signal data."""
import argparse
import base64
import http.client
import json
from pathlib import Path
import ssl

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--resolve', metavar='IP', help='Pin the connection IP, retaining TLS hostname validation')
args = parser.parse_args()
host = 'radar.vitalisite.com'
values = {}
secret_path = Path('/home/debian/.hermes/.env')
if secret_path.stat().st_mode & 0o077:
    raise SystemExit('Secret file must not be group/world accessible')
for line in secret_path.read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
read_key = values['IR_READ_KEY']
assert len(read_key) >= 32, 'Read credential must be strong'
basic = 'Basic ' + base64.b64encode(('radar:' + read_key).encode()).decode()

class Connection(http.client.HTTPSConnection):
    def connect(self):
        sock = self._create_connection((args.resolve or self.host, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)

def get(path, authorization=None):
    conn = Connection(host, timeout=12, context=ssl.create_default_context())
    headers = {'Authorization': authorization} if authorization else {}
    conn.request('GET', path, headers=headers)
    response = conn.getresponse()
    status, body = response.status, response.read()
    assert response.getheader('Strict-Transport-Security') == 'max-age=31536000'
    conn.close()
    return status, body

for path in ['/', '/dashboard', '/dashboard/bilan', '/dashboard/methode', '/dashboard.js', '/dashboard-format.js', '/dashboard.css', '/api/v1/radar/status', '/api/v1/radar/filter-options', '/api/v1/radar/signals', '/api/v1/radar/analytics']:
    status, _ = get(path)
    assert status == 401, (path, status)
    print(f'GET https://{host}{path} unauthenticated: {status}')
status, _ = get('/dashboard', 'Basic aW52YWxpZDppbnZhbGlk')
assert status == 401
print('Invalid credentials: 401')
status, _ = get('/health')
assert status == 403
print('Public diagnostics blocked: 403')
for path in ['/', '/dashboard', '/dashboard.js', '/api/v1/radar/analytics', '/api/v1/radar/runs?limit=1']:
    status, body = get(path, basic)
    assert status == 200, (path, status)
    if path in ['/', '/dashboard']:
        assert b'Journal de recherche' in body and b'LE REGISTRE / 01' in body
    if path == '/dashboard.js':
        assert read_key.encode() not in body
    print(f'GET https://{host}{path} Basic authenticated: {status}')
for authorization, label in [(basic, 'Basic'), ('Bearer ' + read_key, 'Bearer')]:
    status, body = get('/api/v1/radar/signals?limit=1', authorization)
    assert status == 200
    data = json.loads(body)
    assert data['total'] > 0 and len(data['items']) == 1
    print(f'Signals {label}: 200, existing total={data["total"]}, returned={len(data["items"])}')
print('PASS: trusted HTTPS hostname, auth boundary, read-only UI/API, no secret in JS')

"""Verify reviewed shadcn source against official registry digests. Never execute
or overwrite downloaded code. A changed upstream digest requires manual review.
Run from any directory: python3 scripts/vendor-shadcn.py
"""
import hashlib
import json
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
vendor = root / "frontend/components/ui"
for record in json.loads((vendor / "PROVENANCE.json").read_text()):
    url = record["url"]
    if not url.startswith("https://ui.shadcn.com/r/styles/new-york-v4/"):
        raise ValueError("Unexpected registry origin")
    raw = urllib.request.urlopen(url, timeout=30).read()
    if hashlib.sha256(raw).hexdigest() != record["registry_sha256"]:
        raise ValueError("Upstream changed: review before updating " + record["component"])
    item = json.loads(raw)
    for source in item["files"]:
        name = Path(source["path"]).name
        expected = source["content"]
        if name == "dialog.tsx":
            expected = expected.replace("@/registry/new-york-v4/ui/button", "@/components/ui/button").replace('className="sr-only">Close<', 'className="sr-only">Fermer<')
        if name == "table.tsx":
            expected = expected.replace('data-slot="table-container"', 'data-slot="table-container"\n      role="region"\n      aria-label="Tableau de données · défilement horizontal"\n      tabIndex={0}')
        actual = (vendor / name).read_text().split("\n", 1)[1]
        if actual != expected:
            raise ValueError("Unrecorded local adaptation: " + name)
    print(record["component"] + ": reviewed digest and declared adaptations verified")

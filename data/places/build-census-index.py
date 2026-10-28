"""Build navigation-only state lookups from the official 2026 Gazetteer ZIP.

Usage: python data/places/build-census-index.py /scratch/2026_Gaz_place_national.zip
The input remains outside the website; the output keeps only place identifiers,
official names and internal points. No area or population data are published.
"""
import csv
import hashlib
import io
import json
import math
from collections import defaultdict
from pathlib import Path
import sys
import zipfile

SOURCE = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip"
SHA256 = "af678e2d990827c89ee39b98c82de6e90b693c7361ff0e559ae3076670dd2863"
LANDING = "https://www.census.gov/geographies/reference-files/2026/geo/gazetter-file.html"
LAYOUT = "https://www.census.gov/programs-surveys/geography/technical-documentation/records-layout/gaz-record-layouts.html"


def build(source, destination=None):
    destination = Path(destination or Path(__file__).with_name("census-2026"))
    raw = Path(source).read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("The ZIP differs from the verified 2026 Gazetteer release.")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if archive.testzip() is not None:
            raise ValueError("The Gazetteer ZIP failed its integrity check.")
        text = archive.read("2026_Gaz_place_national.txt").decode("utf-8-sig")
    grouped, seen = defaultdict(list), set()
    state_index = json.loads(Path(__file__).with_name("us-places.json").read_text())
    names = {p["stateCode"]: p["name"] for p in state_index["places"] if p["kind"] == "state"}
    names["PR"] = "Puerto Rico"
    for row in csv.DictReader(io.StringIO(text), delimiter="|"):
        code, geoid, name = row["USPS"].strip(), row["GEOID"].strip(), row["NAME"].strip()
        lng, lat = float(row["INTPTLONG"]), float(row["INTPTLAT"])
        if code not in names or len(geoid) != 7 or not geoid.isdigit() or geoid in seen:
            raise ValueError("The Gazetteer contains an invalid or duplicate place identifier.")
        if not name or not all(math.isfinite(v) for v in [lng, lat]) or not (-180 <= lng <= 180 and -85 <= lat <= 85):
            raise ValueError("The Gazetteer contains an invalid place or navigation point.")
        seen.add(geoid)
        grouped[code].append([geoid, name, lng, lat])
    if len(grouped) != 52 or len(seen) != 32363:
        raise ValueError("The Gazetteer does not match the verified national coverage.")
    destination.mkdir(parents=True, exist_ok=True)
    states = []
    for code in sorted(grouped):
        entries = sorted(grouped[code], key=lambda p: (p[1].casefold(), p[0]))
        payload = {"schemaVersion": 1, "state": code, "places": entries}
        data = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
        (destination / (code.lower() + ".json")).write_bytes(data)
        fips = {p[0][:2] for p in entries}
        if len(fips) != 1:
            raise ValueError("One state contains more than one FIPS state code.")
        states.append({"code": code, "fips": next(iter(fips)), "name": names[code], "count": len(entries), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    manifest = {
        "schemaVersion": 1, "year": 2026, "source": "U.S. Census Bureau, 2026 National Places Gazetteer",
        "sourceURL": SOURCE, "documentationURL": LANDING, "recordLayoutURL": LAYOUT,
        "sourceSHA256": SHA256, "sourceBytes": len(raw),
        "license": "U.S. government public domain data",
        "licenseURL": "https://resources.data.gov/open-licenses/",
        "coordinateRole": "Census internal point: navigation only; not a building, rooftop, street address or official boundary.",
        "coverage": "Incorporated places and census-designated places in the 50 states, Washington DC and Puerto Rico. Island Areas are not included.",
        "columns": ["GEOID", "NAME", "INTPTLONG", "INTPTLAT"], "placeCount": len(seen),
        "states": states,
    }
    (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Pass the path to the official 2026_Gaz_place_national.zip.")
    result = build(sys.argv[1])
    print(json.dumps({"states": len(result["states"]), "places": result["placeCount"], "shardBytes": sum(s["bytes"] for s in result["states"]), "largestShard": max(s["bytes"] for s in result["states"])}))

"""Archive exact original USBF bytes under a content-addressed release prefix.

Default is a local plan. --publish uses normal AWS environment/profile discovery;
credentials never enter an argument, manifest or receipt. Every remote object is
read back and hashed; metadata/ETag alone never establish content identity.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.request

CHUNK = 1024 * 1024
HEX = re.compile(r"^[a-f0-9]{64}$")
PUBLIC = "https://data.source.coop/opengeos/us-buildings/USBF_v1/"


def digest(stream):
    checksum, size = hashlib.sha256(), 0
    while block := stream.read(CHUNK):
        checksum.update(block)
        size += len(block)
    return checksum.hexdigest(), size


def publication(raw):
    manifest = json.loads(raw)
    if manifest.get("release") != "USBF_v1" or manifest.get("crs") != "EPSG:4326" or not isinstance(manifest.get("files"), list):
        raise ValueError("Choose the exact published USBF_v1 manifest.")
    files, seen = [], set()
    for item in manifest["files"]:
        name = item.get("path")
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_.+-]+", name) or name.startswith(".") or name in seen or name == "manifest.json":
            raise ValueError("The publication contains an invalid or duplicate flat file key.")
        if not HEX.fullmatch(item.get("sha256", "")) or not isinstance(item.get("bytes"), int) or item["bytes"] < 1:
            raise ValueError("Every original file needs its exact byte length and SHA256.")
        seen.add(name)
        files.append(item)
    if not files:
        raise ValueError("The original publication is empty.")
    sha = hashlib.sha256(raw).hexdigest()
    return {"schema": 1, "manifestSha256": sha, "releasePrefix": "us-buildings/USBF_v1/releases/" + sha + "/",
            "baseUrl": "https://data.source.coop/opengeos/us-buildings/USBF_v1/releases/" + sha + "/",
            "files": files, "sourceBytes": sum(item["bytes"] for item in files), "objects": len(files) + 2,
            "published": False, "geometryIndexComplete": False}


def error_status(error):
    return getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode")


def remote_hash(client, bucket, key):
    response = client.get_object(Bucket=bucket, Key=key)
    body = response["Body"]
    try:
        return digest(body)
    finally:
        body.close()


def put_exact(client, bucket, key, stream, expected, size, content_type):
    try:
        client.head_object(Bucket=bucket, Key=key)
    except Exception as error:
        if error_status(error) != 404:
            raise
        stream.seek(0)
        try:
            client.put_object(Bucket=bucket, Key=key, Body=stream, ContentLength=size,
                              ContentType=content_type, IfNoneMatch="*", Metadata={"sha256": expected})
        except Exception as error:
            # A concurrent writer is acceptable only if the actual bytes agree.
            if error_status(error) not in {409, 412}:
                raise
    if remote_hash(client, bucket, key) != (expected, size):
        raise ValueError("A release key already contains different bytes; it was not overwritten: " + key)


def archive(client, raw, work, source_root=None, bucket="opengeos", progress=None):
    plan = publication(raw)
    work = Path(work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    if source_root:
        source_root = Path(source_root).resolve()
    receipt_file = work / ("original-release-" + plan["manifestSha256"][:12] + ".json")
    receipt = {**plan, "verified": []}
    def save():
        temporary = receipt_file.with_suffix(".writing")
        temporary.write_text(json.dumps(receipt, indent=2) + "\n")
        os.replace(temporary, receipt_file)
    save()
    for item in plan["files"]:
        name = item["path"]
        key = plan["releasePrefix"] + name
        # Restart verifies already-present remote bytes, then avoids re-upload.
        try:
            client.head_object(Bucket=bucket, Key=key)
        except Exception as error:
            if error_status(error) != 404:
                raise
            exists = False
        else:
            exists = True
        if exists:
            if remote_hash(client, bucket, key) != (item["sha256"], item["bytes"]):
                raise ValueError("A release object changed. No overwrite is allowed: " + key)
        else:
            with tempfile.TemporaryFile(dir=work) as staged:
                if source_root:
                    file = source_root / name
                    if not file.resolve().is_relative_to(source_root):
                        raise ValueError("An original file leaves the selected source root.")
                    source = file.open("rb")
                else:
                    source = urllib.request.urlopen(PUBLIC + name, timeout=120)
                with source:
                    checksum, total = hashlib.sha256(), 0
                    while block := source.read(CHUNK):
                        total += len(block)
                        if total > item["bytes"]:
                            raise ValueError("The mutable source no longer has its saved byte length: " + name)
                        checksum.update(block)
                        staged.write(block)
                if checksum.hexdigest() != item["sha256"] or total != item["bytes"]:
                    raise ValueError("The mutable original source changed. Its old release cannot be archived: " + name)
                content_type = "application/vnd.apache.parquet" if name.endswith(".parquet") else "application/json" if name.endswith(".json") else "text/markdown"
                put_exact(client, bucket, key, staged, item["sha256"], item["bytes"], content_type)
        receipt["verified"].append({"path": name, "sha256": item["sha256"], "bytes": item["bytes"]})
        save()
        if progress:
            progress(len(receipt["verified"]), len(plan["files"]))
    # Publication markers are last: an interrupted prefix is never advertised as
    # an available release merely because some source parts were uploaded.
    put_exact(client, bucket, plan["releasePrefix"] + "manifest.json", io.BytesIO(raw), plan["manifestSha256"], len(raw), "application/json")
    marker = json.dumps({"schema": 1, "manifestSha256": plan["manifestSha256"], "sourceBytes": plan["sourceBytes"],
                         "objectsVerified": len(plan["files"]), "originalBytesVerified": True,
                         "geometryBoundsGuaranteed": None, "providerCompleteness": None}, sort_keys=True).encode()
    put_exact(client, bucket, plan["releasePrefix"] + "release.json", io.BytesIO(marker), hashlib.sha256(marker).hexdigest(), len(marker), "application/json")
    receipt["published"] = True
    receipt["registryPatch"] = {"original.baseUrl": plan["baseUrl"], "original.immutable": True,
                                "original.archiveReceiptUrl": plan["baseUrl"] + "release.json"}
    save()
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--work", type=Path, required=True, help="Scratch workspace for one staged shard and resumable receipts")
    parser.add_argument("--source-root", type=Path, help="Existing local exact publication; follows the resolved data root without copying a dataset tree")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    raw = args.manifest.read_bytes()
    plan = publication(raw)
    if not args.publish:
        print(json.dumps({k: v for k, v in plan.items() if k != "files"}, indent=2))
        return
    # No credentials are read, logged, or requested by the website.
    import boto3
    from botocore.config import Config
    client = boto3.client("s3", endpoint_url="https://data.source.coop", region_name="us-east-1",
                          config=Config(request_checksum_calculation="when_required", response_checksum_validation="when_required", retries={"max_attempts": 4}))
    result = archive(client, raw, args.work, args.source_root,
                     progress=lambda done, total: print(json.dumps({"verified": done, "total": total}), flush=True))
    print(json.dumps({k: result[k] for k in ("published", "manifestSha256", "baseUrl", "registryPatch")}, indent=2))


if __name__ == "__main__":
    main()

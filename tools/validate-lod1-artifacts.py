"""Read exported models with independent PROJ/GEOS, ZIP and binary format readers."""
import argparse
import io
import json
import struct
import sys
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
parser.add_argument("--libs", type=Path, required=True)
args = parser.parse_args()
sys.path.insert(0, str(args.libs))
import numpy as np
import pyproj
import shapely
from shapely.geometry import Polygon, shape
from shapely.ops import transform, unary_union

checks = []
def check(value, name):
    assert value, name
    checks.append(name)
    print("PASS", name)

fixture = json.loads((args.directory / "lod1-fixtures.json").read_text())
metadata = fixture["model"]
projection = pyproj.Transformer.from_crs("EPSG:4326", metadata["location"]["proj4"], always_xy=True)
inverse = pyproj.Transformer.from_crs(metadata["location"]["proj4"], "EPSG:4326", always_xy=True)
vertices, faces, part_indices = [], [], []
for row in (args.directory / "lod1-model.obj").read_text().splitlines():
    values = row.split()
    if values and values[0] == "v":
        vertices.append([float(v) for v in values[1:4]])
    elif values and values[0] == "o":
        part_indices.append([])
    elif values and values[0] == "f":
        ids = [int(v) - 1 for v in values[1:4]]
        faces.append(ids)
        part_indices[-1].append(len(faces) - 1)
vertices = np.asarray(vertices, dtype=np.float64)
faces = np.asarray(faces, dtype=np.int64)
check(np.isfinite(vertices).all() and len(faces) == metadata["counts"]["triangles"], "Independent OBJ reader finds finite geometry and every declared triangle")
expected_parts = []
max_projection_error = 0.0
for record in metadata["records"]:
    source = fixture["snapshot"]["features"][record["sourceIndex"]]
    polygon = transform(projection.transform, shape(source["geometry"]))
    originals = list(polygon.geoms) if polygon.geom_type == "MultiPolygon" else [polygon]
    check(len(originals) == len(record["parts"]), "Multipart geometry retains each original building part: " + record["sourceId"])
    for part, polygon in zip(record["parts"], originals):
        triangles = vertices[faces[part_indices[part]]]
        roof_triangles = triangles[np.all(np.abs(triangles[:, :, 2] - record["heightMetres"]) < 1e-8, axis=1)]
        roof = unary_union([Polygon(t[:, :2]) for t in roof_triangles])
        check(roof.symmetric_difference(polygon).area < .001, "GEOS verifies the roof exactly covers its projected footprint and leaves holes open: " + str(part))
        signed_volume = np.sum(np.einsum("ij,ij->i", triangles[:, 0], np.cross(triangles[:, 1], triangles[:, 2]))) / 6
        check(abs(signed_volume - polygon.area * record["heightMetres"]) < .01, "Closed mesh volume equals footprint area times the supplied height: " + str(part))
        edges = Counter()
        directed = Counter()
        for tri in triangles:
            for a, b in zip(tri, np.roll(tri, -1, axis=0)):
                a, b = tuple(np.round(a, 7)), tuple(np.round(b, 7))
                edges[tuple(sorted((a, b)))] += 1
                directed[(a, b)] += 1
        check(all(count == 2 for count in edges.values()) and all(directed[(a, b)] == directed[(b, a)] for a, b in directed), "Every mesh edge joins two consistently outward-oriented faces: " + str(part))
        base_points = triangles[:, :, :2][np.abs(triangles[:, :, 2]) < 1e-9]
        rings = [polygon.exterior, *polygon.interiors]
        for ring in rings:
            for original in ring.coords:
                error = np.min(np.linalg.norm(base_points - original, axis=1))
                max_projection_error = max(max_projection_error, float(error))
        expected_parts.append((polygon, record["heightMetres"]))
check(max_projection_error < .001, "Independent PROJ locates every original source vertex within one millimetre")
anchor = metadata["location"]["anchorWGS84"]
check(np.linalg.norm(projection.transform(*anchor)) < 1e-6 and np.linalg.norm(np.asarray(inverse.transform(0, 0)) - anchor) < 1e-10, "The saved AEQD geographic origin reversibly maps to zero without bounding-box centering")

binary = (args.directory / "lod1-model.glb").read_bytes()
magic, version, length, json_length, json_kind = struct.unpack_from("<5I", binary)
check(magic == 0x46546C67 and version == 2 and length == len(binary) and json_kind == 0x4E4F534A, "Independent GLB reader validates header, file length and JSON chunk")
gltf = json.loads(binary[20:20 + json_length])
bin_length, bin_kind = struct.unpack_from("<2I", binary, 20 + json_length)
payload = binary[28 + json_length:]
check(bin_kind == 0x004E4942 and bin_length == len(payload) and gltf["buffers"][0]["byteLength"] == len(payload), "The binary geometry is embedded with matching chunk and buffer lengths")
def accessor(index):
    access = gltf["accessors"][index]
    view = gltf["bufferViews"][access["bufferView"]]
    assert access["componentType"] == 5126 and access["type"] == "VEC3"
    array = np.frombuffer(payload, dtype="<f4", count=access["count"] * 3, offset=view.get("byteOffset", 0) + access.get("byteOffset", 0)).reshape((-1, 3))
    if "min" in access:
        assert np.array_equal(array.min(axis=0), access["min"]) and np.array_equal(array.max(axis=0), access["max"])
    return array
for i, mesh in enumerate(gltf["meshes"]):
    primitive = mesh["primitives"][0]
    positions, normals = accessor(primitive["attributes"]["POSITION"]), accessor(primitive["attributes"]["NORMAL"])
    enu = positions[:, [0, 2, 1]].copy()
    enu[:, 1] *= -1
    expected = vertices[faces[part_indices[i]]].reshape((-1, 3))
    check(np.max(np.abs(enu - expected)) < .001, "GLB Y-up coordinates recover the same ENU geometry within float precision: " + str(i))
    triangles = positions.reshape((-1, 3, 3))
    cross = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    cross /= np.linalg.norm(cross, axis=1)[:, None]
    check(np.min(np.einsum("ij,ij->i", cross, normals.reshape((-1, 3, 3))[:, 0])) > .999, "GLB face normals retain the outward orientation after the axis conversion: " + str(i))
check(gltf["extras"]["usBuildings"]["location"] == metadata["location"] and "CC BY-NC 4.0" in gltf["asset"]["copyright"], "The standalone GLB carries its geographic origin, full input scope and component rights")
for format in ["obj", "glb"]:
    with ZipFile(args.directory / ("lod1-" + format + ".zip")) as archive:
        check(archive.testzip() is None and all(f.flag_bits & 0x800 for f in archive.infolist()), "Python zipfile independently verifies ZIP CRC and UTF-8 filenames: " + format)
        details = json.loads(archive.read("location.json"))
        records = json.loads(archive.read("records.json"))["records"]
        check(details["source"] == metadata["source"] and details["location"] == metadata["location"] and records == metadata["records"], "Model package retains source release, licenses, full attributes and invertible placement: " + format)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
fig = plt.figure(figsize=(11, 5))
ax = fig.add_subplot(121, projection="3d")
collection = Poly3DCollection(vertices[faces], facecolor="#68a397", edgecolor="#244d44", linewidth=.25, alpha=.98)
ax.add_collection3d(collection)
ax.set_xlim(vertices[:, 0].min() - 3, vertices[:, 0].max() + 3)
ax.set_ylim(vertices[:, 1].min() - 3, vertices[:, 1].max() + 3)
ax.set_zlim(0, vertices[:, 2].max() + 5)
ax.set_box_aspect((np.ptp(vertices[:, 0]), np.ptp(vertices[:, 1]), np.ptp(vertices[:, 2])))
ax.view_init(30, -55)
ax.set_xlabel("East · m")
ax.set_ylabel("North · m")
ax.set_zlabel("Height · m")
ax.set_title("Flat-roof LoD1 geometry")
ax = fig.add_subplot(122)
for polygon, height in expected_parts:
    ax.fill(*polygon.exterior.xy, color="#68a397", edgecolor="#244d44")
    for ring in polygon.interiors:
        ax.fill(*ring.xy, color="white", edgecolor="#244d44")
ax.set_aspect("equal")
ax.set_xlabel("East · m")
ax.set_ylabel("North · m")
ax.set_title("Original footprint coverage and courtyard")
fig.tight_layout()
fig.savefig(args.directory / "lod1-independent-render.png", dpi=150)
result = {"passed": True, "checks": checks, "maximumProjectionErrorMetres": max_projection_error, "reader": "PROJ " + pyproj.__proj_version__ + " / GEOS " + shapely.geos_version_string}
(args.directory / "lod1-independent-validation.json").write_text(json.dumps(result, indent=2))
print(json.dumps({"passed": True, "checks": len(checks), "maxProjectionErrorMetres": max_projection_error}))

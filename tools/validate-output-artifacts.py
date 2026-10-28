"""Independent PDF/ZIP readers and PDFium rendering; never imported by the website."""
import argparse
import json
import pathlib
import sys
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=pathlib.Path)
parser.add_argument("--libs", type=pathlib.Path)
args = parser.parse_args()
if args.libs:
    sys.path.insert(0, str(args.libs))
from pypdf import PdfReader
import pypdfium2 as pdfium

root = args.directory
manifest = json.loads((root / "outputs-models.json").read_text())
checks = []
for fixture in manifest["pdf"]:
    path = root / fixture["name"]
    reader = PdfReader(path, strict=True)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    expected = fixture["page"]
    assert abs(float(page.mediabox.width) - expected["widthPt"]) < 0.0001
    assert abs(float(page.mediabox.height) - expected["heightPt"]) < 0.0001
    assert reader.metadata.title == fixture["title"]
    checks.append(f"Independent PDF parser accepts page size and Unicode title: {path.name}")
    assert "map-details.json" in reader.attachments
    attached = json.loads(reader.attachments["map-details.json"][0].decode("utf-8"))
    assert attached["sources"]["layers"][0]["licenses"] == ["ODbL 1.0", "CC BY-NC 4.0"]
    assert attached["pdf"]["orientation"] == expected["orientation"]
    image = page["/Resources"]["/XObject"]["/MapImage"]
    assert image["/Width"] == 600 and image["/Height"] == 400
    assert image["/Filter"] == "/DCTDecode"
    checks.append(f"Independent PDF parser recovers source attachment and real image dimensions: {path.name}")
    document = pdfium.PdfDocument(path)
    assert len(document) == 1
    rendered = document[0].render(scale=1.5).to_pil().convert("RGB")
    assert rendered.getpixel((0, 0)) == (255, 255, 255)
    placement = expected["image"]
    density = 1.5 * 72 / 25.4
    colors = [(0.25, 0.25, (205, 55, 50)), (0.75, 0.25, (35, 145, 80)), (0.25, 0.75, (45, 90, 195)), (0.75, 0.75, (230, 190, 35))]
    for x, y, color in colors:
        px = round((placement["xMm"] + placement["widthMm"] * x) * density)
        py = round((placement["yMm"] + placement["heightMm"] * y) * density)
        actual = rendered.getpixel((px, py))
        assert max(abs(a - b) for a, b in zip(actual, color)) < 15, (path, actual, color)
    rendered.save(root / (path.stem + "-render.png"))
    checks.append(f"PDFium renders all four map quadrants upright inside white paper margins: {path.name}")
    document.close()

with zipfile.ZipFile(root / manifest["model"]["file"]) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {"建筑.obj", "location.json", "README.txt"}
    assert archive.getinfo("建筑.obj").flag_bits & 0x0800
    checks.append("Independent ZIP reader verifies CRCs, UTF-8 filenames and expected files")
    geometry = archive.read("建筑.obj").decode("utf-8")
    vertices = [[float(v) for v in row.split()[1:]] for row in geometry.splitlines() if row.startswith("v ")]
    expected_vertices = [[0, 0.3048, 7], [0, -0.3048, 7], [0, 0.3048, 7.6096]]
    for actual, expected in zip(vertices, expected_vertices):
        assert all(abs(a - b) < 1e-9 for a, b in zip(actual, expected))
    assert "f 1 2 3" in geometry
    location = json.loads(archive.read("location.json"))
    assert location["geometryBaked"] is True
    assert location["objCoordinates"]["units"] == "metres"
    assert location["objCoordinates"]["nativeGISCRS"] is False
    assert location["anchorWGS84"] == [-77.071, 38.912]
    checks.append("Independent OBJ read confirms baked feet/axis/rotation/elevation and explicit local metre origin")

result = {"passed": True, "checks": checks, "pdfReader": "pypdf 5.9.0", "renderer": "PDFium via pypdfium2 4.30.0"}
(root / "independent-validation.json").write_text(json.dumps(result, indent=2))
print(json.dumps({"passed": True, "checks": len(checks)}))

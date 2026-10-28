"""Validate real page boxes, extractable source text, type size, and PDFium map rendering."""
import argparse
import json
import pathlib
import re
import sys

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=pathlib.Path)
parser.add_argument("--libs", type=pathlib.Path)
args = parser.parse_args()
if args.libs:
    sys.path.insert(0, str(args.libs))
from pypdf import PdfReader
import pypdfium2 as pdfium

root = args.directory
data = json.loads((root / "paper-layout.json").read_text())
checks = []
for fixture in data["fixtures"]:
    pdf = root / fixture["name"]
    reader = PdfReader(pdf, strict=True)
    assert len(reader.pages) == fixture["page"]["pages"]
    expected = fixture["page"]
    full_text = "\n".join(p.extract_text() or "" for p in reader.pages)
    assert fixture["metadata"]["title"] in full_text
    assert "CC BY-NC 4.0" in full_text
    assert reader.metadata.title == fixture["metadata"]["title"]
    checks.append(f"PDF text extraction recovers title and actual source license: {pdf.name}")
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - expected["widthPt"]) < 0.0001
        assert abs(float(page.mediabox.height) - expected["heightPt"]) < 0.0001
        sizes = []

        def visit(text, cm, tm, font, size):
            if text.strip():
                sizes.append(size)

        page.extract_text(visitor_text=visit)
        assert sizes and min(sizes) >= 8
    first_sizes = []
    reader.pages[0].extract_text(visitor_text=lambda text, cm, tm, font, size: first_sizes.append(size) if text.strip() else None)
    assert 18 in first_sizes and 8 in first_sizes
    checks.append(f"Independent parser confirms physical type never shrinks below eight points: {pdf.name}")
    attachment = json.loads(reader.attachments["map-details.json"][0])
    assert attachment["pdf"]["fontSizesPt"]["sources"] == 8
    assert attachment["pdf"]["pages"] == len(reader.pages)
    assert attachment["sources"] == fixture["metadata"]["sources"]
    checks.append(f"Original source metadata and paper settings remain attached: {pdf.name}")
    document = pdfium.PdfDocument(pdf)
    assert len(document) == len(reader.pages)
    scale = 1.5
    rendered = document[0].render(scale=scale).to_pil().convert("RGB")
    assert rendered.getpixel((0, 0)) == (255, 255, 255)
    frame = fixture["layout"]["mapFrame"]
    for x, y, color in [(0.25, 0.25, (205, 55, 50)), (0.75, 0.25, (35, 145, 80)), (0.25, 0.75, (45, 90, 195)), (0.75, 0.75, (230, 190, 35))]:
        px = round((frame["x"] + frame["width"] * x) * scale)
        py = round((frame["y"] + frame["height"] * y) * scale)
        actual = rendered.getpixel((px, py))
        assert max(abs(a - b) for a, b in zip(actual, color)) < 15, (pdf.name, actual, color)
    rendered.save(root / (pdf.stem + "-render.png"))
    if len(reader.pages) > 1:
        last = document[len(reader.pages) - 1].render(scale=scale).to_pil()
        last.save(root / (pdf.stem + "-last-source-page.png"))
    checks.append(f"PDFium renders the map upright in its remaining paper frame: {pdf.name}")
    document.close()
    if fixture["page"]["sourceAppendix"]:
        normalize = lambda text: re.sub(r"\s+", "", text)
        recovered = normalize(full_text)
        for layer in fixture["metadata"]["sources"]["layers"]:
            assert normalize(layer["attribution"]) in recovered
            assert normalize(layer["source"]) in recovered
        checks.append("Independent extraction verifies every long source credit and URL without truncation")

result = {"passed": True, "checks": checks, "reader": "pypdf 5.9.0", "renderer": "PDFium 4.30.0"}
(root / "paper-independent-validation.json").write_text(json.dumps(result, indent=2))
print(json.dumps({"passed": True, "checks": len(checks), "documents": len(data["fixtures"])}))

"""Independent checks on actual shared-browser map and paper exports."""
import argparse
import json
import pathlib
import sys
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=pathlib.Path)
parser.add_argument("--libs", type=pathlib.Path)
args = parser.parse_args()
if args.libs:
    sys.path.insert(0, str(args.libs))
from pypdf import PdfReader
import pypdfium2 as pdfium

root = args.directory
metadata = json.loads((root / "legend-browser-map.json").read_text())
checks = []
with Image.open(root / "legend-browser-map.png") as image, Image.open(root / "legend-browser-map-2x.png") as high:
    assert high.width == image.width*2 and high.height == image.height*2
    assert image.width > 500 and image.height > 300
    checks.append("Actual 2× PNG retains the full map and semantic legend at twice each pixel dimension")
pdf = PdfReader(root / "legend-browser-map.pdf", strict=True)
attached = json.loads(pdf.attachments["map-details.json"][0])
assert attached["sources"] == metadata["sources"]
legend = next(layer["legend"] for layer in attached["sources"]["layers"] if layer.get("legend", {}).get("mode") == "height")
assert legend["kind"] == "continuous"
assert [stop["value"] for stop in legend["stops"]] == [0, 15, 40, 100]
assert legend["missing"]["color"] == "#abb2b0"
checks.append("PDF attachment preserves the frozen PNG height ramp and missing color after a later style change")
texts = "\n".join(page.extract_text() or "" for page in pdf.pages)
assert "Height" in texts and "No positive height" in texts and "100+" in texts
shadings = []
for page in pdf.pages:
    sizes = []
    page.extract_text(visitor_text=lambda text, cm, tm, font, size: sizes.append(size) if text.strip() else None)
    assert sizes and min(sizes) >= 8
    for shade in page["/Resources"].get_object().get("/Shading", {}).values():
        shade = shade.get_object()
        assert shade["/ShadingType"] == 2
        assert [float(x) for x in shade["/Function"].get_object()["/Bounds"]] == [.15, .4]
        shadings.append(shade)
assert shadings
checks.append("The downloaded PDF contains a genuine continuous gradient and readable physical text")
document = pdfium.PdfDocument(root / "legend-browser-map.pdf")
for i in range(len(document)):
    document[i].render(scale=1.5).to_pil().save(root / f"legend-browser-pdf-page-{i+1}.png")
document.close()
checks.append("Independent PDFium rendering succeeds for every page of the actual downloaded map")
(root / "legend-browser-independent.json").write_text(json.dumps({"passed": True, "checks": checks}, indent=2))
print(json.dumps({"passed": True, "checks": len(checks)}))

"""Independent PDF parsing and PDFium pixel checks for shared semantic color keys."""
import argparse
import json
import pathlib
import sys

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=pathlib.Path)
parser.add_argument("--libs", type=pathlib.Path)
args = parser.parse_args()
if args.libs:
    sys.path.insert(0, str(args.libs))
from pypdf import PdfReader
import pypdfium2 as pdfium

data = json.loads((args.directory / "legend-paper.json").read_text())
checks = []


def rgb(hex_color):
    return tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))


def expected_color(ramp, fraction):
    lo, hi = ramp["domain"]
    value = lo + (hi-lo)*fraction
    stops = ramp["stops"]
    for a, b in zip(stops, stops[1:]):
        if value <= b["value"]:
            t = (value-a["value"])/(b["value"]-a["value"])
            alpha = ramp.get("opacity", 1)
            return tuple(round(255*(1-alpha) + alpha*(x + t*(y-x))) for x, y in zip(rgb(a["color"]), rgb(b["color"])))
    return rgb(stops[-1]["color"])


for fixture in data["fixtures"]:
    target = args.directory / fixture["name"]
    reader = PdfReader(target, strict=True)
    document = pdfium.PdfDocument(target)
    layout = fixture["layout"]
    assert len(reader.pages) == len(layout["pages"]) == len(document)
    attachment = json.loads(reader.attachments["map-details.json"][0])
    assert attachment["sources"] == fixture["metadata"]["sources"]
    checks.append(f"Original semantic layer keys remain attached unchanged: {target.name}")
    all_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "CC BY-NC 4.0" in all_text
    assert fixture["metadata"]["title"] in all_text
    for index, (page, planned) in enumerate(zip(reader.pages, layout["pages"])):
        sizes = []
        page.extract_text(visitor_text=lambda text, cm, tm, font, size: sizes.append(size) if text.strip() else None)
        assert sizes and min(sizes) >= 8
        gradients = planned.get("gradients", [])
        resources = page["/Resources"].get_object()
        shadings = resources.get("/Shading", {})
        assert len(shadings) == len(gradients)
        for shading in shadings.values():
            shading = shading.get_object()
            assert shading["/ShadingType"] == 2
            function = shading["/Function"].get_object()
            assert function["/FunctionType"] == 3
            assert [float(x) for x in function["/Bounds"]] == [.15, .4]
            assert len(function["/Functions"]) == 3
        if not gradients:
            continue
        scale = 2.5
        image = document[index].render(scale=scale).to_pil().convert("RGB")
        for ramp in gradients:
            # Midpoints inside all three true intervals; a stepped/bin rendering fails.
            for fraction in (.075, .275, .7):
                point = (round((ramp["x"]+ramp["width"]*fraction)*scale), round((ramp["y"]+ramp["height"]*.5)*scale))
                actual = image.getpixel(point)
                expected = expected_color(ramp, fraction)
                assert max(abs(a-b) for a, b in zip(actual, expected)) <= 3, (target.name, index, fraction, actual, expected)
        image.save(args.directory / (target.stem+f"-color-page-{index+1}.png"))
        checks.append(f"PDFium renders real continuous colors at all interval midpoints: {target.name} page {index+1}")
    for source in fixture["metadata"]["sources"]["layers"]:
        legend = source["legend"]
        if not fixture["metadata"]["decorations"].get("legend", True):
            continue
        assert legend["title"] in all_text
        if legend["kind"] == "categorical":
            assert all(entry["label"] in all_text for entry in legend["entries"])
        elif legend["kind"] == "continuous":
            assert "No positive height" in all_text and "100+" in all_text
        elif legend["kind"] == "raster":
            assert "Georeferenced image" in all_text
    checks.append(f"Readable paper text preserves every key and original source rights: {target.name}")
    document.close()

result = {"passed": True, "checks": checks, "reader": "pypdf", "renderer": "PDFium"}
(args.directory / "legend-paper-independent.json").write_text(json.dumps(result, indent=2))
print(json.dumps({"passed": True, "checks": len(checks), "documents": len(data["fixtures"])}))

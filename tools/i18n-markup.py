"""Annotate source-owned interface text with explicit translation bindings.

Run after adding copy to i18n-zh.js. This never visits data/, vendor/, export
engines, arbitrary rendered text, property values or interpolated HTML values.
English remains in each source template. Review the source diff before commit.
"""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parent.parent
COPY = (ROOT / 'i18n-zh.js').read_text().split('Object.fromEntries(`', 1)[1].split('`.trim()', 1)[0]
KEYS = {row.split('|', 1)[0] for row in COPY.strip().splitlines()}
for locale_file in ['i18n-projects-zh.js', 'i18n-usbf-zh.js']:
    if (ROOT / locale_file).exists():
        copy = (ROOT / locale_file).read_text().split('Object.fromEntries(`', 1)[1].split('`.trim()', 1)[0]
        KEYS.update(row.split('|', 1)[0] for row in copy.strip().splitlines())
OPAQUE_IDS = {'table-layer-name', 'workspace-document', 'model-collection-note', 'model-map-name', 'model-map-kind', 'study-area-name'}
FILES = ['index.html', 'app.js', 'workspace-tools.js', 'workspace-crs.js',
         'model-browser.js', 'local-models.js', 'data-manager.js', 'data-import.js',
         'inventory.js', 'buildings-explorer.js', 'analysis-ui.js',
         'map-composer.js', 'map-project.js', 'lod1-ui.js']
SYSTEM_IDS = set('toast status-message dialog-title dialog-eyebrow tool-hint measure-text '
                 'data-workspace-label map-data-context inventory-height-note inventory-scope '
                 'export-scope-note table-scope-note table-kind table-count table-page '
                 'model-message local-model-message local-model-location-text data-message '
                 'raster-style-status composer-data-message composer-map-message '
                 'composer-page-summary composer-preview-caption map-composer-title '
                 'project-message draw-message draw-progress study-message '
                 'workspace-crs-example workspace-settings-message explorer-place-help '
                 'explorer-place-query-label analysis-message analysis-changed analysis-operation-note '
                 'analysis-overview-note analysis-run-spatial analysis-snapshot-scope '
                 'analysis-source-note analysis-original-data analysis-chart-field-label '
                 'lod1-message lod1-counts lod1-create lod1-scope-note'.split())
TAG = re.compile(r'<([a-zA-Z][\w:-]*)([^<>]*?)>')

def annotate_tags(source):
    def tag(match):
        text = match[0]
        id_match = re.search(r'\bid="([\w-]+)"', text)
        if id_match and id_match[1] in SYSTEM_IDS and 'data-i18n-system' not in text:
            text = text[:-1] + ' data-i18n-system>'
        for name in ['title', 'aria-label', 'placeholder']:
            attr = re.search(r'\b' + name + r'="([^"]*)"', text)
            if attr and html.unescape(attr[1]).strip() in KEYS and 'data-i18n-' + name not in text:
                text = text[:-1] + ' data-i18n-' + name + '>'
        return text
    return TAG.sub(tag, source)

def annotate_text(source):
    # Only complete static text runs from the English source are eligible.
    pattern = re.compile(r'(<([a-zA-Z][\w:-]*)([^<>]*?)>|</[\w:-]+>)([^<>\n]+)(?=<)')
    def text(match):
        opening, tag, attrs, content = match.groups()
        if html.unescape(content).strip() not in KEYS:
            return match[0]
        if tag:
            identifier = re.search(r'\bid="([\w-]+)"', attrs)
            if identifier and identifier[1] in OPAQUE_IDS:
                return match[0]
            if tag.lower() in ['script', 'style', 'svg', 'text', 'title', 'code', 'pre', 'td', 'dd']:
                return match[0]
            if 'data-i18n' not in attrs:
                opening = opening[:-1] + ' data-i18n>'
            return opening + content
        # Text after an icon, checkbox or other child needs its own binding.
        return opening + '<span data-i18n>' + content + '</span>'
    return pattern.sub(text, source)

if __name__ == '__main__':
    for name in FILES:
        path = ROOT / name
        before = path.read_text()
        after = annotate_text(annotate_tags(before))
        if after != before:
            path.write_text(after)
            print(name)

"""Render IMPLEMENTATION_GUIDE.md to TICKSHOW_IMPLEMENTATION_GUIDE.pdf.

Requires:
    python -m pip install markdown xhtml2pdf reportlab

Run from the repository root:
    python scripts/build-implementation-pdf.py
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import markdown
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from xhtml2pdf import pisa

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "IMPLEMENTATION_GUIDE.md"
OUTPUT = ROOT / "TICKSHOW_IMPLEMENTATION_GUIDE.pdf"


def find_unicode_font() -> Path | None:
    candidates = [
        Path(r"C:\Windows\Fonts\ARIALUNI.TTF"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ]
    return next((path for path in candidates if path.exists()), None)


def register_fonts(font_path: Path | None) -> None:
    if font_path is None:
        return
    if "DocUnicode" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("DocUnicode", str(font_path)))
    if "DocUnicode-Bold" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("DocUnicode-Bold", str(font_path)))


CSS = """
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-family: DocUnicode;
    font-size: 8pt;
    color: #777777;
  }
}

body {
  font-family: DocUnicode;
  font-size: 9.4pt;
  line-height: 1.46;
  color: #1d2421;
}

h1 {
  font-family: DocUnicode-Bold;
  font-size: 22pt;
  color: #10291c;
  margin: 0 0 4mm 0;
  padding-bottom: 3mm;
  border-bottom: 2px solid #a9dd36;
}

h2 {
  font-family: DocUnicode-Bold;
  font-size: 15pt;
  color: #17432b;
  margin-top: 9mm;
  margin-bottom: 3mm;
  border-bottom: 1px solid #d8e6cd;
  padding-bottom: 1.5mm;
}

h3 {
  font-family: DocUnicode-Bold;
  font-size: 11.5pt;
  color: #26623c;
  margin-top: 6mm;
  margin-bottom: 2mm;
}

p, li { orphans: 2; widows: 2; }
ul, ol { margin-top: 1.5mm; margin-bottom: 2.5mm; }

strong { font-family: DocUnicode-Bold; }

a { color: #1c6b3a; text-decoration: none; }

code {
  font-family: DocUnicode;
  font-size: 8.1pt;
  background-color: #f1f4ef;
  color: #17311f;
}

pre {
  font-family: DocUnicode;
  font-size: 7.6pt;
  line-height: 1.3;
  background-color: #f4f6f2;
  border-left: 2px solid #a9dd36;
  padding: 3mm;
  margin: 2mm 0 4mm 0;
  white-space: pre-wrap;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 2mm 0 4mm 0;
  font-size: 8.2pt;
}

th {
  background-color: #eaf4dc;
  color: #12301f;
  text-align: left;
  font-family: DocUnicode-Bold;
  border: 0.5px solid #b9cbb0;
  padding: 1.8mm 2mm;
}

td {
  border: 0.5px solid #d5ddd2;
  padding: 1.6mm 2mm;
  vertical-align: top;
}

tr { page-break-inside: avoid; }

blockquote {
  border-left: 2px solid #a9dd36;
  margin-left: 0;
  padding-left: 4mm;
  color: #4a554e;
}

hr {
  border: none;
  border-top: 1px solid #dde5da;
  margin: 5mm 0;
}
"""


def build() -> None:
    markdown_text = SOURCE.read_text(encoding="utf-8")
    html_body = markdown.markdown(
        markdown_text,
        extensions=["tables", "fenced_code", "sane_lists", "attr_list"],
    )

    font_path = find_unicode_font()
    font_face = ""
    if font_path is not None:
        staging_dir = ROOT / ".firecrawl"
        staging_dir.mkdir(exist_ok=True)
        staged_font = staging_dir / "DocUnicode.ttf"
        shutil.copy2(font_path, staged_font)
        font_face = """
@font-face {
  font-family: DocUnicode;
  src: url(".firecrawl/DocUnicode.ttf");
}
@font-face {
  font-family: DocUnicode-Bold;
  src: url(".firecrawl/DocUnicode.ttf");
}
"""

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{font_face}{CSS}</style>
</head>
<body>
{html_body}
</body>
</html>
"""

    register_fonts(font_path)
    with OUTPUT.open("wb") as target:
        result = pisa.CreatePDF(html, dest=target, encoding="utf-8")

    if result.err:
        raise SystemExit(f"PDF generation failed with {result.err} error(s)")

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    os.chdir(ROOT)
    build()

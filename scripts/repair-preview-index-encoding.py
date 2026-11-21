from pathlib import Path
import re
import tempfile
from html.parser import HTMLParser

root = Path(__file__).resolve().parents[1]
html_path = root / "public" / "index.html"
css_path = root / "public" / "styles.css"
backup = Path(tempfile.gettempdir()) / "bco-preview-index-before-text-repair-20261121.html"
source = html_path.read_text(encoding="utf-8-sig")
backup.write_text(source, encoding="utf-8")
markers = ("\u0139", "\u0102", "\u00c4", "\u00c5", "\u00e2", "\u00f0", "\u0178", "\u2122", "\u203a", "\u0152", "\u0153", "\u0098", "\u009a", "\u009e")
converted = 0

def repair_token(token):
    global converted
    if not any(marker in token for marker in markers):
        return token
    raw = bytearray()
    try:
        for char in token:
            try:
                raw.extend(char.encode("cp1250"))
            except UnicodeEncodeError:
                code = ord(char)
                if 0x80 <= code <= 0x9F:
                    raw.append(code)
                else:
                    return token
        fixed = raw.decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return token
    if "\ufffd" in fixed or fixed == token:
        return token
    converted += 1
    return fixed

fixed = re.sub(r"\S+", lambda match: repair_token(match.group(0)), source)
if '<div class="preview-banner">' in fixed:
    banner_count = 1
else:
    fixed, banner_count = re.subn(r'<div style="[^"]+">[^<]*</div>', '<div class="preview-banner">BCO PREVIEW / TEST - BACKEND API IS DISABLED</div>', fixed, count=1)
if banner_count != 1:
    raise SystemExit(f"Expected one preview banner, found {banner_count}; no files written")
if re.search(r"\bstyle\s*=", fixed, re.I):
    raise SystemExit("Inline style attribute remains; no files written")
if "\ufffd" in fixed:
    raise SystemExit("Replacement character detected; no files written")
class CheckHTML(HTMLParser):
    pass
CheckHTML().feed(fixed)
if "P\u0159ihl\u00e1sit" not in fixed:
    raise SystemExit("Known Czech login button did not repair as expected")
html_path.write_text(fixed, encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
if ".preview-banner" not in css:
    css += "\n\n/* Isolated preview notice; external CSS keeps CSP style attributes disabled. */\n.preview-banner{position:sticky;top:0;z-index:99999;background:#9b1c1c;color:#fff;text-align:center;padding:8px 12px;font:800 12px Arial;letter-spacing:.08em}\n"
    css_path.write_text(css, encoding="utf-8")
remaining = sum(fixed.count(marker) for marker in markers)
print(f"PASS: repaired {converted} mojibake tokens; remaining marker hits={remaining}; HTML parsed; no inline style attributes; backup={backup}")

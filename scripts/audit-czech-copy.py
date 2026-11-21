from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / 'public'
SEQUENCES = tuple(chr(x) for x in (0x00c3, 0x00c4, 0x00c5))
REPLACEMENT = chr(0xfffd)
C1 = set(chr(x) for x in range(0x80, 0xa0))
CZECH_MARKERS = tuple(chr(x) for x in (0x00e1,0x00e9,0x00ed,0x00f3,0x00fa,0x0161,0x010d,0x0159,0x017e))
SUFFIXES = ('.html','.js','.css','.json','.webmanifest','.svg')

def scan(path):
    text = path.read_text(encoding='utf-8-sig')
    issues=[]
    if REPLACEMENT in text:
        issues.append(('replacement-char',text.count(REPLACEMENT)))
    c1=sum(text.count(ch) for ch in C1)
    if c1: issues.append(('C1-controls',c1))
    mojibake=0
    for i,ch in enumerate(text[:-1]):
        if ch in SEQUENCES and text[i+1] in CZECH_MARKERS:
            mojibake+=1
    if mojibake: issues.append(('utf8-as-latin-mojibake',mojibake))
    return text,issues

for path in sorted(ROOT.rglob('*')):
    if path.is_file() and path.suffix.lower() in SUFFIXES:
        try:
            text,issues=scan(path)
        except Exception as error:
            print('READ_ERROR',path,error)
            continue
        if issues:
            print('COPY_WARNING',path.relative_to(ROOT),issues)
        elif path.suffix.lower()=='.html':
            print('COPY_OK',path.relative_to(ROOT),'utf8; no replacement chars; no C1 controls; no common mojibake')

html=(ROOT/'index.html').read_text(encoding='utf-8-sig')
required=(
    'P'+chr(345)+'ihl'+chr(225)+'sit',
    'P'+chr(345)+chr(237)+'stupov'+chr(233)+' heslo',
    'Odemknout Business OS',
    'Vy'+chr(345)+'e'+chr(353)+'it zad'+chr(225)+'n'+chr(237),
    'P'+chr(345)+'ihl'+chr(225)+'sit se ke cloudu',
    'Z'+chr(225)+'lo'+chr(382)+'n'+chr(237)+' body',
    'Ulo'+chr(382)+'it z'+chr(225)+'lo'+chr(382)+'n'+chr(237)+' bod',
    'Naj'+chr(237)+'t 10 fotek pomoc'+chr(237)+' AI'
)
for label in required:
    if label not in html:
        raise SystemExit('MISSING_OR_BROKEN_UI_TEXT '+ascii(label))
if 'name="viewport"' not in html:
    raise SystemExit('MOBILE_VIEWPORT_MISSING')
print('PASS: critical Czech login and mobile shell labels are present')

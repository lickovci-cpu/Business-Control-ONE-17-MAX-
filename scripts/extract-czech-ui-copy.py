from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'public'
OUT=Path(__file__).resolve().parents[1]/'docs'/'czech-ui-copy-review.txt'
letters=set(chr(x) for x in [0x00e1,0x00e9,0x00ed,0x00f3,0x00fa,0x016f,0x010d,0x010f,0x011b,0x0148,0x0159,0x0161,0x0165,0x017e,0x00c1,0x00c9,0x00cd,0x00d3,0x00da,0x010c,0x010e,0x011a,0x0158,0x0160,0x0164,0x017d])
markers=('textContent','innerHTML','placeholder','aria-label','title','alert(','confirm(','toast','notify','showError','showMessage')
lines=[]
for path in sorted(ROOT.rglob('*.js')):
    for number,line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(),1):
        if any(ch in line for ch in letters) and any(marker in line for marker in markers):
            lines.append(f'{path.relative_to(ROOT)}:{number}: {line.strip()[:900]}')
OUT.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('WROTE_UTF8_REVIEW_FILE',len(lines))

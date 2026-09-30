"""Reorder paragraph border children to the schema order (top, left, bottom, right)."""
import re, sys, zipfile, glob, os, shutil

PAT = re.compile(r'<w:pBdr>(<w:top [^>]*/>)(<w:bottom [^>]*/>)(<w:left [^>]*/>)(<w:right [^>]*/>)</w:pBdr>')

for path in glob.glob(os.path.join(sys.argv[1], '*.docx')):
    tmp = path + '.tmp'
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == 'word/document.xml':
                text, n = PAT.subn(lambda m: '<w:pBdr>' + m.group(1) + m.group(3) + m.group(2) + m.group(4) + '</w:pBdr>', data.decode('utf-8'))
                data = text.encode('utf-8')
                print(os.path.basename(path), 'fixed', n)
            zout.writestr(item, data)
    shutil.move(tmp, path)

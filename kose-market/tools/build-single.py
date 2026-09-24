# Tüm CSS/JS'yi tek bir HTML dosyasına gömer → dist/KoseMarket.html (çift tıkla oynanır)
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
def css(m):
    return "<style>\n" + (root / m.group(1)).read_text(encoding="utf-8") + "\n</style>"
def js(m):
    code = (root / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"
html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', css, html)
html = re.sub(r'<script src="([^"]+\.js)"></script>', js, html)
out = root / "dist" / "KoseMarket.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(out, len(html))

#!/usr/bin/env python3
"""BAG MERGE — tek dosyalık dağıtım paketi üretir.

Görselleri, yazı tiplerini, CSS'i ve JS'i tek bir HTML'in içine gömer.
Sonuç dosya herhangi bir bilgisayarda çift tıklanarak açılır: sunucu
gerekmez, internet gerekmez, Windows'ta da çalışır.

    python3 paketle.py

NEDEN ELLE LİSTE YOK
--------------------
Siber Koşu'nun paketleyicisinde her görselin adı elle yazılmış bir tablo
vardı; yeni bir görsel eklenip tabloya yazılmayı unutunca paket sessizce
eksik çıkıyordu. Burada öyle bir tablo YOK: assets/ klasöründe ne varsa
otomatik gömülür.

NASIL ÇALIŞIYOR
---------------
* CSS ve HTML içinde geçen "assets/..." yolları doğrudan data: URI ile
  değiştirilir (yazı tipleri böyle giriyor).
* JS'teki yollar çalışma anında üretiliyor (item_paris_3.png gibi), yani
  metin değiştirmekle yakalanamaz. Onun için sayfaya bir arama tablosu
  gömülüyor: window.GOMULU_ASSETS. script.js her görseli bu tablodan
  geçirir (bkz. gorselYolu), tablo yoksa dosyadan okur.
"""
import base64
import os
import sys

KOK = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
CIKTI = os.path.expanduser("~/Desktop/BAG MERGE (tek dosya).html")

# Gömülecek dosya türleri. Listede olmayan (README, LICENSE, .DS_Store...)
# atlanır — pakete gereksiz yük binmesin.
TURLER = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".woff2": "font/woff2", ".woff": "font/woff",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
}


def oku(ad):
    with open(os.path.join(KOK, ad), encoding="utf-8") as f:
        return f.read()


def varliklari_topla():
    """assets/ altındaki her dosyayı 'assets/alt/klasor/ad.png' -> data: URI."""
    tablo = {}
    kok_assets = os.path.join(KOK, "assets")
    if not os.path.isdir(kok_assets):
        print("UYARI: assets/ klasörü yok, hiçbir görsel gömülmedi.")
        return tablo
    for dizin, _, dosyalar in os.walk(kok_assets):
        for d in sorted(dosyalar):
            uzanti = os.path.splitext(d)[1].lower()
            if uzanti not in TURLER:
                continue
            tam = os.path.join(dizin, d)
            gorece = os.path.relpath(tam, KOK).replace(os.sep, "/")
            with open(tam, "rb") as f:
                ham = f.read()
            tablo[gorece] = "data:%s;base64,%s" % (
                TURLER[uzanti], base64.b64encode(ham).decode("ascii"))
    return tablo


def yollari_goem(metin, tablo):
    """Metindeki 'assets/...' yollarını data: URI ile değiştirir.

    Uzun yol önce: 'assets/fonts/a.woff2' ile 'assets/fonts/a.woff' gibi
    biri diğerinin başlangıcı olan adlarda yanlış eşleşme olmasın diye.
    """
    for yol in sorted(tablo, key=len, reverse=True):
        if yol in metin:
            metin = metin.replace(yol, tablo[yol])
    return metin


def js_tablosu(tablo):
    satirlar = ",\n".join('"%s":"%s"' % (k, v) for k, v in sorted(tablo.items()))
    return "window.GOMULU_ASSETS={\n%s\n};" % satirlar


def main():
    print("Kaynak klasör:", KOK)
    tablo = varliklari_topla()
    print("Gömülen dosya:", len(tablo))

    html = oku("index.html")
    css = yollari_goem(oku("style.css"), tablo)
    js = oku("script.js")          # JS'teki yollar tabloyla çözülüyor, değiştirilmiyor

    # <link rel="stylesheet" href="style.css"> -> <style>...</style>
    link = '<link rel="stylesheet" href="style.css">'
    if link not in html:
        raise SystemExit("HATA: index.html içinde stil bağlantısı bulunamadı.")
    html = html.replace(link, "<style>\n%s\n</style>" % css)

    # <script src="script.js"></script> -> gömülü tablo + gömülü script
    etiket = '<script src="script.js"></script>'
    if etiket not in html:
        raise SystemExit("HATA: index.html içinde script bağlantısı bulunamadı.")
    html = html.replace(etiket, "<script>\n%s\n</script>\n<script>\n%s\n</script>"
                        % (js_tablosu(tablo), js))

    # HTML'in kendi içinde kalan yollar (varsa)
    html = yollari_goem(html, tablo)

    with open(CIKTI, "w", encoding="utf-8") as f:
        f.write(html)

    mb = os.path.getsize(CIKTI) / (1024 * 1024)
    print("Hazır: %s  (%.1f MB)" % (CIKTI, mb))
    if mb > 60:
        print("UYARI: Dosya 60 MB'ı geçti. E-postayla göndermek zor olabilir;")
        print("       görselleri küçültmeyi düşün.")


if __name__ == "__main__":
    main()

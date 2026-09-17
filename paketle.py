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
eksik çıkıyordu. Burada öyle bir tablo YOK.

Ölçüt "klasörde var mı" değil, "KODDA GEÇİYOR MU": index.html, script.js ve
style.css taranıyor, adı hiçbirinde geçmeyen dosya pakete girmiyor. Klasörde
eski denemeler birikiyor (eski isim ekranları, kaldırılmış hediyelikler) ve
bunlar paketi yüz megabaytlarca şişiriyordu. Dosyalar diskte duruyor,
yalnızca pakete girmiyorlar; hangilerinin atlandığı üretim sırasında
yazılıyor.

Bir dosyanın adı kodda iki şekilde geçebilir: CSS ve HTML "assets/ad.png"
diye tam yolu yazar, script.js'teki tablolar ise yalnızca dosya adını
("item_urfa.png") tutar ve "assets/" önekini çalışırken ekler. İkisi de
aranıyor.

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
import re
import os
import shutil
import subprocess
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


def varliklari_topla(kaynak):
    """Kodda ADI GEÇEN her dosyayı 'assets/alt/klasor/ad.png' -> data: URI.

    kaynak: index.html + script.js + style.css metinleri birleşik.
    """
    tablo, atlanan = {}, []
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
            if gorece not in kaynak and d not in kaynak:
                atlanan.append((gorece, os.path.getsize(tam)))
                continue
            with open(tam, "rb") as f:
                ham = f.read()
            tablo[gorece] = "data:%s;base64,%s" % (
                TURLER[uzanti], base64.b64encode(ham).decode("ascii"))
    if atlanan:
        toplam = sum(b for _, b in atlanan) / (1024 * 1024)
        print("Kodda geçmediği için atlanan %d dosya (%.1f MB):"
              % (len(atlanan), toplam))
        for yol, b in sorted(atlanan):
            print("   %-34s %6.2f MB" % (yol, b / (1024 * 1024)))
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

    html_ham = oku("index.html")
    css_ham  = oku("style.css")
    js       = oku("script.js")    # JS'teki yollar tabloyla çözülüyor, değiştirilmiyor

    tablo = varliklari_topla(html_ham + css_ham + js)
    print("Gömülen dosya:", len(tablo))

    # HTML yorumları pakete girmiyor: içlerinde "assets/..." geçen bir yorum
    # olunca o yol da görselin tamamıyla değiştiriliyordu. Başlangıç görseli
    # yalnızca bir açıklama satırında adı geçtiği için pakete fazladan 2,6 MB
    # olarak giriyordu. Taramada (yukarıda) yorumlar hâlâ sayılıyor; yorumda
    # adı geçen dosya da gömülüyor ama yorumun kendisi değil.
    html = re.sub(r"<!--.*?-->", "", html_ham, flags=re.S)
    css = yollari_goem(css_ham, tablo)

    # SIRA ÖNEMLİ: HTML'in kendi "assets/..." yolları ÖNCE değiştiriliyor.
    # Sonra yapılırsa sayfaya gömülen arama tablosunun ANAHTARLARI da
    # ("assets/x.png": "data:...") birer yol sanılıp data URI ile
    # değiştiriliyor ve her görsel pakete İKİ KEZ giriyor; paket 40 MB
    # yerine 100 MB çıkıyordu.
    html = yollari_goem(html, tablo)

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

    # Eski dosyanın ÜSTÜNE yazılmıyor: Finder önizlemeyi dosyaya göre
    # önbellekte tutuyor ve yerinde değişen dosyada eski oyunun görüntüsü
    # kalıyordu. Yanına yazılıp yerine taşınınca yeni bir dosya oluyor ve
    # önizleme baştan çıkarılıyor.
    gecici = CIKTI + ".yaziliyor"
    with open(gecici, "w", encoding="utf-8") as f:
        f.write(html)
    if os.path.exists(CIKTI):
        os.remove(CIKTI)
    os.replace(gecici, CIKTI)
    # Önizleme önbelleğini de tazele (yalnızca macOS'ta var).
    if shutil.which("qlmanage"):
        subprocess.run(["qlmanage", "-r", "cache"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    mb = os.path.getsize(CIKTI) / (1024 * 1024)
    print("Hazır: %s  (%.1f MB)" % (CIKTI, mb))
    if mb > 60:
        print("UYARI: Dosya 60 MB'ı geçti. E-postayla göndermek zor olabilir;")
        print("       görselleri küçültmeyi düşün.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
BAG MERGE — yerel oyun sunucusu

Neden hazır "python3 -m http.server" değil de bu dosya?

1) ÖNBELLEK. Hazır sunucu tarayıcıya "bu dosya ne zamana kadar geçerli"
   bilgisini vermiyor; Chrome da eski script.js / style.css / görselleri
   önbellekten veriyor. Kioskta kimse "hard refresh" yapamayacağı için
   burada her yanıta "sakla" başlığı ekliyoruz: dosyalar hep taze gelir.

2) EŞ ZAMANLI İSTEK. Oyun açılışta bütün görselleri paralel çekiyor;
   bekleme kuyruğunu büyütüyoruz ki hiçbir istek düşmesin.

3) GÜVENLİK. Sadece 127.0.0.1'e bağlanır — oyun klasörü ağdaki başka
   cihazlara açılmaz.

Kullanım:  python3 sunucu.py 8223
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class OyunHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass          # terminal penceresini istek günlüğüyle doldurma


class OyunSunucusu(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8223
    os.chdir(os.path.dirname(os.path.abspath(__file__)))   # her zaman oyun klasörü
    OyunSunucusu(('127.0.0.1', port), OyunHandler).serve_forever()

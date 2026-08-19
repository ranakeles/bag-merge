#!/bin/bash
# =====================================================================
#  BAG MERGE — oyunu başlat (Mac)
#
#  index.html'e çift tıklamak yetmez: tarayıcı file:// üzerinde bazı
#  görsel işlemlerini engelliyor. Bu dosya küçük bir yerel sunucu
#  (sunucu.py) başlatıp oyunu onun üzerinden açar.
#
#  İki tuzak, iki önlem:
#  1) Portta BAŞKA bir klasörün sunucusu çalışıyor olabilir → sadece
#     "port dolu mu" bakmıyoruz, işaret dosyasıyla doğruluyoruz.
#  2) Tarayıcı ESKİ dosyaları önbellekten verebiliyor → yalnızca
#     "önbellekleme kapalı" başlığı gönderen kendi sunucumuzu kabul
#     ediyoruz.
#
#  NOT: Siber Koşu 8123-8140 aralığını kullanıyor; iki oyun aynı anda
#  açık olabilsin diye burası 8223'ten başlıyor.
# =====================================================================

cd "$(dirname "$0")" || exit 1

BEKLENEN="BAG-MERGE"
PORT=""

# --- Bu klasörü sunan ve önbelleklemeyi kapatan sunucumuz zaten var mı? ---
for p in $(seq 8223 8240); do
  YANIT="$(curl -s -m 1 -i "http://localhost:$p/bagmerge.marker" 2>/dev/null)"
  if printf '%s' "$YANIT" | grep -q "$BEKLENEN" && printf '%s' "$YANIT" | grep -qi "no-store"; then
    PORT=$p
    echo "Çalışan sunucu bulundu (port $PORT)."
    break
  fi
done

# --- Yoksa boş bir port bulup kendi sunucumuzu başlat ---
if [ -z "$PORT" ]; then
  for p in $(seq 8223 8240); do
    if ! curl -s -m 1 -o /dev/null "http://localhost:$p/" 2>/dev/null; then
      PORT=$p
      break
    fi
  done
  if [ -z "$PORT" ]; then
    echo "HATA: Boş port bulunamadı (8223-8240 dolu)."
    read -r -p "Kapatmak için Enter'a bas..." _
    exit 1
  fi

  echo "Sunucu başlatılıyor (port $PORT)..."
  python3 "$(pwd)/sunucu.py" "$PORT" >/dev/null 2>&1 &

  HAZIR=""
  for _ in $(seq 1 25); do
    if curl -s -m 1 "http://localhost:$PORT/bagmerge.marker" 2>/dev/null | grep -q "$BEKLENEN"; then
      HAZIR="evet"; break
    fi
    sleep 0.2
  done
  if [ -z "$HAZIR" ]; then
    echo ""
    echo "HATA: Sunucu başlatılamadı."
    echo "Bilgisayarda python3 kurulu mu diye bakalım; şunu çalıştır:"
    echo "    python3 --version"
    read -r -p "Kapatmak için Enter'a bas..." _
    exit 1
  fi
fi

# --- Tarayıcıda aç (zaman damgası: adres de tazelensin) ---
URL="http://localhost:$PORT/index.html?t=$(date +%s)"
echo "Oyun açılıyor: $URL"
open "$URL"

echo ""
echo "Oyun tarayıcıda açıldı. Bu pencereyi kapatabilirsin."
sleep 2

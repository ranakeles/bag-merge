/* =========================================================
   BAG MERGE — script.js
   Makineye bas → komşu hücrelere hediyelik düşer → aynı ikiliyi birleştir
   → şehrin simgesi → bagaj → bagajı yukarıdaki DOĞRU uçağa sürükle.
   Bölümler:
   1) Ayarlar + şehir zincirleri
   2) Görsel havuzu (assets/ içinde ne varsa o kullanılır)
   3) Durum + küçük yardımcılar
   4) Sahne ölçüsü
   5) Izgara ve parçalar
   6) Makine (bagaj bandı)
   7) Sürükleme: taşı / birleştir / teslim et
   8) Uçaklar (siparişler)
   9) Akış: başlangıç → oyun → bitiş
   ========================================================= */

/* ---------- 1) AYARLAR + ŞEHİR ZİNCİRLERİ ---------- */
const SUTUN = 7, SATIR = 9;

/* ---- TAHTA GÖRSELİ ----
   Izgara artık koddan çizilmiyor: tahtanın tamamı tek bir görsel
   (assets/matrix.png) ve hücreler onun üstüne oturuyor. Aşağıdaki sayılar
   GÖRSELDEN ÖLÇÜLDÜ (parlaklık geçişlerinden hücre kenarları bulundu):
   görsel 1100x1429, ilk hücrenin sol üstü (38, 45), hücre adımı yatayda
   146.14 px, dikeyde 146.44 px — 7 sütun ve 9 satır tam oturuyor.

   GÖRSEL DEĞİŞİRSE BU SAYILAR DA DEĞİŞMELİ. Yoksa çocuk bir hücreye basar,
   yandaki tepki verir. Ölçüm yöntemi: hücre sıraları boyunca parlaklık
   farkının tepe yaptığı yerler hücre kenarlarıdır.                       */
/* ---- TEZGAH ----
   Uçaklar tezgahın üst yüzeyine basıyor. Yüzeyin bittiği yer GÖRSELDEN
   ÖLÇÜLDÜ: 2172x724 görselde açık mor üst yüzey y=490'a kadar sürüyor,
   uçakların basacağı çizgi olarak y=470 alındı (yüzeyin ön tarafı). Bu
   sayı görsel değişirse yeniden ölçülmeli.                              */
const TEZGAH = {
  gorsel:'assets/tezgah.png',
  en:2172, boy:724,
  zeminY:470,                    // uçakların bastığı çizgi (px, üstten)
  opakAlt:583                    // tezgahın gerçekten bittiği yer; altı şeffaf
};
/* Uçak yuvaları tezgahın ALTINDAN bu kadar yukarıda duruyor */
const TEZGAH_ZEMIN = (TEZGAH.boy - TEZGAH.zeminY) / TEZGAH.boy * 100;
/* Görselin altındaki şeffaf şerit boşuna yer kaplıyordu (görsel boyunun
   %19,5'i). Tahtayı o kadar yukarı çekiyoruz. Yüzde marjlar KAPSAYICININ
   GENİŞLİĞİNE göre hesaplandığı için değer görsel oranıyla çarpılıyor. */
const TEZGAH_ALT = (1 - TEZGAH.opakAlt / TEZGAH.boy) * (TEZGAH.boy / TEZGAH.en) * 100;

/* ---- PLAKA (biniş kartı) ----
   Yazılar plakanın krem alanına yazılıyor; alanın sınırları da görselden
   ölçüldü (1821x864 görselde x 171-1509, y 220-644).                    */
const PLAKA = {
  gorsel:'assets/plaka.png',
  en:1821, boy:864,
  alanX:9.39, alanY:25.46, alanEn:73.53, alanBoy:49.19   // krem alan, yüzde
};

const MANZARA = 'assets/bg_istanbul.png';

/* ---- RAKAMLAR ----
   Sayılar yazı tipiyle değil GÖRSELDEN diziliyor: 0-9 tek bir şeritte
   çizili, kod her rakamı oradan kesip yan yana koyuyor. Web yazı tipi
   oyunun kalın, konturlu, gölgeli çizimlerinin yanında düz kalıyordu.
   (Siber Koşu'da da skor rakamları böyle yapılmıştı.)

   Kutular şeridin PİKSELLERİNDEN ölçüldü: saydam olmayan alanlar taranıp
   iki satıra ayrıldı, her rakamın sınırları tek tek çıkarıldı. Şerit
   değişirse yeniden ölçülmeli.

   Rakam kutuları 1em YÜKSEKLİĞE göre ölçekleniyor; genişlik rakamın kendi
   oranından geliyor, yani "1" dar, "0" geniş kalıyor.                     */
const RAKAM = {
  gorsel:'assets/score_numbers.png',
  en:1774, boy:887,
  kutular:[
    { x:  71, y: 53, en:317, boy:373 },   // 0
    { x: 422, y: 54, en:235, boy:368 },   // 1
    { x: 727, y: 53, en:302, boy:364 },   // 2
    { x:1066, y: 53, en:294, boy:373 },   // 3
    { x:1387, y: 54, en:321, boy:368 },   // 4
    { x:  66, y:462, en:297, boy:367 },   // 5
    { x: 399, y:459, en:305, boy:369 },   // 6
    { x: 737, y:463, en:297, boy:363 },   // 7
    { x:1062, y:459, en:304, boy:370 },   // 8
    { x:1416, y:459, en:300, boy:369 }    // 9
  ]
};

/* Bir sayıyı kabın içine rakam rakam dizer. Rakam olmayan karakterler
   (":" ve "/") şeritte yok, onlar yazıyla geçiyor — sayının kendisi değil
   ayıraç oldukları için göze batmıyor. */
function sayiYaz(el, metin){
  if(!el) return;
  metin = String(metin);
  if(!gorselVar(RAKAM.gorsel)){ el.textContent = metin; return; }
  const yol = gorselYolu(RAKAM.gorsel);
  el.textContent = '';
  el.classList.add('sayi');
  for(const ch of metin){
    const i = ch.charCodeAt(0) - 48;
    if(i < 0 || i > 9){
      const ay = document.createElement('i');
      ay.className = 'sayi-ayrac';
      ay.textContent = ch;
      el.appendChild(ay);
      continue;
    }
    const k = RAKAM.kutular[i];
    const r = document.createElement('i');
    r.className = 'sayi-rakam';
    /* Ölçek: rakamın kendi boyu 1em'e getiriliyor, şerit de aynı oranda. */
    const o = k.boy;
    r.style.width           = (k.en / o) + 'em';
    r.style.backgroundImage = 'url(' + yol + ')';
    r.style.backgroundSize  = (RAKAM.en / o) + 'em ' + (RAKAM.boy / o) + 'em';
    r.style.backgroundPosition = (-k.x / o) + 'em ' + (-k.y / o) + 'em';
    el.appendChild(r);
  }
}

/* ---- İSİM GİRİŞİ ----
   Tasarımın tamamı assets/enter_name3.png içinde — klavye dahil. Aşağıdaki
   koordinatlar 941x1672'lik görselin PİKSELLERİNDEN ölçüldü: tuşların açık
   mor yüzleri tarandı, satır satır ayrıldı ve harflerle eşleştirildi. Kod
   bunların üstüne görünmez düğmeler koyuyor.

   GÖRSEL DEĞİŞİRSE BU TABLO YENİDEN ÖLÇÜLMELİ.

   Türkçe Q düzeni, 32 harf tuşu: Ğ Ü Ş İ Ö Ç dahil. Önceki görsellerde
   ikinci sıradan sürekli bir harf düşüyordu ve eksik Ş'yi kod çizmek
   zorunda kalmıştık; bu tasarımda sıra tam, o geçici çözüm kalktı.        */
const ISIM = {
  gorsel:'assets/enter_name5.png',
  en:941, boy:1672,
  baslik:{ x:199, y:111,  en:549, boy:113 },   // şeridin yüzü — "ADINI YAZ"
  kutu:  { x:116, y:764,  en:695, boy:93  },   // yazılan ismin krem alanı
  buton: { x:275, y:1439, en:372, boy:119 },   // altın buton — "BAŞLA"
  /* Dokunma alanı çizilen tuştan biraz geniş: parmak kenara denk gelince
     harf kaybolmasın. Tuşlar arası boşluk ~8 px, bu pay güvenli. */
  tusPayi:4,
  satirlar:[
    { y:940,  boy:85, tuslar:[
      ['Q',28,67],['W',103,66],['E',177,66],['R',251,67],['T',326,66],['Y',401,66],
      ['U',475,67],['I',550,67],['O',625,67],['P',700,66],['Ğ',774,66],['Ü',848,66] ] },
    { y:1051, boy:86, tuslar:[
      ['A',50,71],['S',129,69],['D',206,68],['F',283,67],['G',359,69],['H',436,69],
      ['J',514,68],['K',591,69],['L',669,69],['Ş',746,69],['İ',823,70] ] },
    { y:1162, boy:88, tuslar:[
      ['Z',46,78],['X',134,75],['C',219,76],['V',305,75],['B',390,74],
      ['N',474,74],['M',558,73],['Ö',640,72],['Ç',721,73] ] }
  ],
  sil:    { x:802, y:1162, en:105, boy:88 },   // ⌫
  bosluk: { x:131, y:1279, en:679, boy:84 }
};
const AD_MIN = 2, AD_MAX = 12;   // 12'den uzun isim skor tablosuna sığmıyor
let yazilanAd = '';

/* ---- BİTİŞ EKRANI ----
   İki ayrı tasarım: hepsi teslim edildiyse "TÜM BAGAJLAR TESLİM EDİLDİ",
   süre dolduysa "BANT KARIŞTI". İkisi de 941x1672.

   HER İKİSİNİN ÖLÇÜSÜ AYRI. Aynı yerleşimde olduklarını varsaymıştım ama
   değiller: süre dolan tasarımda üstteki şerit hem daha aşağıda hem daha
   dar (sol kenarı 68 değil 124). O yüzden alanlar tasarım başına yazılıyor.
   Görsel değişirse yeniden ölçülmeli — sütun ayıraçları ve ikonların
   altındaki boş bant, parlaklık geçişlerinden bulunuyor.                 */
const BITIS = {
  en:941, boy:1672,
  basarili:{
    gorsel:'assets/end_page_success.png',
    /* Kutular SÜTUNUN değil İKONUN altına ortalanıyor. Sütun sınırlarına
       göre kurulduğunda ilk sütun diğerlerinden geniş olduğu için sayı
       ikonun soluna kayıyordu. İkon merkezleri görselden ölçüldü:
       211.5, 383, 557, 729.5 — kutular bu merkezlere oturuyor. */
    alanlar:{
      bitPuan:   { x:130, y:769, en:164, boy:68 },
      bitHatali: { x:301, y:769, en:164, boy:68 },
      bitDogru:  { x:475, y:769, en:164, boy:68 },
      bitSure:   { x:648, y:769, en:164, boy:68 }
    },
    tablo:{ x:199, y:930, en:539, boy:417 }
  },
  sureDoldu:{
    gorsel:'assets/end_page_fail.png',
    /* İkon merkezleri: 209.5, 381.5, 556, 728.5 */
    alanlar:{
      bitPuan:   { x:128, y:832, en:164, boy:71 },
      bitHatali: { x:300, y:832, en:164, boy:71 },
      bitDogru:  { x:474, y:832, en:164, boy:71 },
      bitSure:   { x:647, y:832, en:164, boy:71 }
    },
    tablo:{ x:199, y:1000, en:538, boy:427 }
  }
};

/* ---- ÜST BİLGİ PANELLERİ ----
   Üç panel de tek tek ÖLÇÜLDÜ. İki ölçü lazım:
   - "cerceve": mor-mavi kasanın sınırları. Panelin ekranda kaplayacağı yer
     bu; görsellerin etrafındaki şeffaf pay her birinde farklı, kasaya göre
     hizalanmazsa üç panel farklı boyda duruyor.
   - "alan": sayının yazılacağı krem yüzey.

   Kasa oranları da birbirinden biraz farklı (3.19 / 3.55 / 3.62). Üçü yan
   yana duracağı için ORTAK bir orana (HUD_ORAN) esnetiliyorlar; fark en
   fazla %8 ve yuvarlak bir kasada fark edilmiyor. Sıranın düzgün olması
   panel başına birkaç pikselden önemli.                                  */
const HUD = {
  siparis:{ gorsel:'assets/hud_siparis.png', en:1866, boy:843,
            cerceve:{x:77, y:153, en:1712, boy:537},
            alan:{x:162, y:233, en:1529, boy:363} },
  puan:   { gorsel:'assets/hud_puan.png',    en:2172, boy:724,
            cerceve:{x:39, y:60,  en:2093, boy:589},
            alan:{x:497, y:157, en:1497, boy:371} },
  sure:   { gorsel:'assets/hud_sure.png',    en:2172, boy:724,
            cerceve:{x:33, y:64,  en:2105, boy:582},
            alan:{x:312, y:153, en:1685, boy:375} }
};
const HUD_ORAN = 3.45;   // panelin en/boy oranı (üç kasanın ortalaması)

/* ---- HAVAYOLLARI ----
   Uçuş kodunun önü havayolundan geliyor: THY TK, AJet VF, SunExpress XQ.
   Şehir tablosunda yalnızca uçuş NUMARASI duruyor, kodun tamamı burada
   birleşiyor — böylece aynı sefer numarası farklı havayoluyla da çıkabilir.
   Görseli olmayan havayolu için logosuz uçak (plane.png) kullanılıyor. */
const HAVAYOLLARI = {
  thy:        { ad:'Turkish Airlines', on:'TK', dosya:'assets/ucak_thy.png' },
  ajet:       { ad:'AJet',             on:'VF', dosya:'assets/ucak_ajet.png' },
  sunexpress: { ad:'SunExpress',       on:'XQ', dosya:'assets/ucak_sunexpress.png' }
};
const UCAK_YEDEK = 'assets/plane.png';

const TAHTA = {
  gorsel:'assets/matrix.png',
  en:1100, boy:1429,      // görselin piksel ölçüsü
  x0:38, y0:45,           // ilk hücrenin sol üst köşesi
  adimX:146.14, adimY:146.44
};
/* Tahtanın ekrandaki boyu hücre cinsinden: görsel, hücre adımı kadar
   ölçeklenince bu kadar hücre eni/boyu kaplıyor. */
const TAHTA_EN  = TAHTA.en  / TAHTA.adimX;   // ≈ 7.53 hücre
const TAHTA_BOY = TAHTA.boy / TAHTA.adimY;   // ≈ 9.76 hücre
/* Hücrenin görsel içindeki yüzdesi — konumlar bundan türüyor. */
const HUCRE_EN_YUZDE  = TAHTA.adimX / TAHTA.en  * 100;
const HUCRE_BOY_YUZDE = TAHTA.adimY / TAHTA.boy * 100;
/* Makine ızgaranın ORTASINDA: sekiz komşusu da var, düşen hediyelikler
   parmağın rahat ulaştığı yere geliyor. Kenara alınırsa komşu sayısı
   üçe düşüyor ve makine sürekli "yer yok" diyor.                        */
const MAKINE_YERI = { s:4, k:3 };
/* MAKİNE İKİ TÜRLÜ ÇALIŞIYOR:
   1) Kendi kendine, düzenli aralıklarla birer hediyelik döküyor. Böylece
      hiç dokunulmasa bile tahta besleniyor; çocuk sadece birleştirmeye
      odaklansa da oyun ilerliyor.
   2) Dokununca ANINDA, daha fazlasını döküyor. Beklemesi yok — basıp
      hiçbir şey olmaması çocuğa bozuk düğme gibi geliyordu.

   Tıkanmayı süre değil tahtanın kendisi sınırlıyor: yer kalmayınca elle
   basışta uyarı çıkıyor, kendiliğinden düşüm ise sessizce bekliyor.
   Bir turda kendiliğinden ~40 hediyelik düşüyor; bir bagaj 8 tane istiyor. */
const MAKINE_ADET = 3;         // dokununca düşen hediyelik
const MAKINE_KENDI_ADET = 1;   // kendiliğinden düşen hediyelik
const MAKINE_KENDI_ARALIK = 2000;  // ms — kendiliğinden düşüm aralığı

const HEDEF_SIPARIS = 6;       // bu kadar bagaj teslim edilince oyun biter
/* Siparişlerin HEPSİ tezgahta duruyor; tezgah yana kaydırılıyor. Bu sayı
   aynı anda kaç tanesinin ekrana sığdığı — kaydırma adımı da bu. */
const GORUNEN_UCAK = 3;

const PUAN_SIPARIS = 150;
const PUAN_BIRLESTIR = 10;     // × ulaşılan basamak
/* SÜRE GERİ SAYIYOR. Tur bu süreyle sınırlı: altı siparişi yetiştirebilirsen
   kazanıyorsun, süre biterse tur orada kapanıyor. Kioskta sıra beklendiği
   için turun kesin bir sonu olmalı.                                      */
const TUR_SURESI = 120;        // saniye (2:00)
const PUAN_KALAN_SANIYE = 5;   // bitişte artan her saniye bu kadar puan
const AZ_KALDI = 15;           // bu saniyenin altında sayaç uyarıya geçer

/* Her şehrin KENDİ zinciri var: makineden çıkan 1. basamak, iki kere
   birleşe birleşe o şehrin simgesine, en sonunda da o şehrin bagajına
   dönüşüyor.

   DOSYA ADI TABLODA YAZIYOR. Önce adı koddan üretiyorduk (item_paris_1.png)
   ama görseller başka türlü adlandırılmış geldi ve oyunda hiç görünmediler.
   Artık ad serbest: dosyayı assets/ içine at, buradaki "dosya" alanına yaz,
   başka hiçbir yeri değiştirmeye gerek yok.

   "ucuslar" yalnızca sefer NUMARASI; başındaki harfler havayolundan gelir.
   "havayollari" o şehre uçan şirketler — New York uzun menzil olduğu için
   sadece THY'de.

   "renk" yalnızca görsel HENÜZ YOKKEN çizilen geçici kutunun rengi. */
const SEHIRLER = {
  paris: {
    ad:'Paris', kod:'CDG', renk:'#C0392B',
    ucuslar:['1823','1827','1831'],
    havayollari:['thy','ajet'],
    zincir:[
      { ad:'Bere',         dosya:'item_paris1_bere.png' },
      { ad:'Kruvasan',     dosya:'item_paris2_croissant.png' },
      { ad:'Eyfel Kulesi', dosya:'item_paris3_eiffel.png' },
      { ad:'Paris Bagajı', dosya:'item_paris4_luggage.png' }
    ]
  },
  newyork: {
    ad:'New York', kod:'JFK', renk:'#2E86C1',
    ucuslar:['0003','0011','0455'],
    havayollari:['thy'],
    zincir:[
      { ad:'Güneş Gözlüğü',      dosya:'item_newyork1.png' },
      { ad:'Hot Dog',            dosya:'item_newyork2.png' },
      { ad:'Özgürlük Heykeli',   dosya:'item_newyork3.png' },
      { ad:'New York Bagajı',    dosya:'item_newyork4.png' }
    ]
  },
  roma: {
    ad:'Roma', kod:'FCO', renk:'#D35400',
    ucuslar:['1861','1863','1867'],
    havayollari:['thy','ajet','sunexpress'],
    zincir:[
      { ad:'Şapka',        dosya:'item_rome1.png' },
      { ad:'Pizza Dilimi', dosya:'item_rome2.png' },
      { ad:'Kolezyum',     dosya:'item_rome3.png' },
      { ad:'Roma Bagajı',  dosya:'item_rome4.png' }
    ]
  },
  londra: {
    ad:'Londra', kod:'LHR', renk:'#1F618D',
    ucuslar:['1979','1981','1987'],
    havayollari:['thy','ajet'],
    zincir:[
      { ad:'Şemsiye',           dosya:'item_london1.png' },
      { ad:'Çift Katlı Otobüs', dosya:'item_london2.png' },
      { ad:'Big Ben',           dosya:'item_london3.png' },
      { ad:'Londra Bagajı',     dosya:'item_london4.png' }
    ]
  }
};
const SEHIR_LISTE = Object.keys(SEHIRLER);
/* Zincirin son basamağı bagaj. Uzunluk tabloya bakılarak bulunuyor ki
   basamak sayısını değiştirmek tek satırlık bir iş olsun.               */
const SON_BASAMAK = SEHIRLER.paris.zincir.length;

/* Bir bagaj için kaç tane 1. basamak hediyelik gerekiyor: her basamak iki
   parçadan oluştuğu için 2^(basamak-1). Dört basamaklı zincirde 8.
   Basamak sayısı değişirse bu da kendiliğinden düzelir.                   */
const TABAN_ADET = Math.pow(2, SON_BASAMAK - 1);

/* ---------- 2) GÖRSEL HAVUZU ----------
   Kod HİÇBİR ŞEY ÇİZMEZ; her parça bir PNG. Ama görseller parça parça
   geliyor, oyunun o arada çalışmaz hâle gelmemesi lazım: her görsel için
   dosya var mı diye bakılır, yoksa yerine GEÇİCİ renkli kutu konur.
   Dosya assets/ içine düştüğü anda kodda değişiklik gerekmez.

   Tek dosyalık pakette (paketle.py) görseller data: URI olarak
   window.GOMULU_ASSETS içine gömülür; o zaman dosya sorgusu yapılmaz.  */
const GOMULU = window.GOMULU_ASSETS || null;
const VAR_OLAN = new Set();
function gorselYolu(ad){ return (GOMULU && GOMULU[ad]) || ad; }
function gorselVar(ad){ return VAR_OLAN.has(ad); }

function basamakBilgisi(sehir, basamak){ return SEHIRLER[sehir].zincir[basamak-1]; }
function parcaGorseli(sehir, basamak){ return 'assets/' + basamakBilgisi(sehir, basamak).dosya; }

function beklenenGorseller(){
  const liste = ['assets/machine.png','assets/home_page.png',
                 TAHTA.gorsel, TEZGAH.gorsel, PLAKA.gorsel, MANZARA, UCAK_YEDEK,
                 BITIS.basarili.gorsel, BITIS.sureDoldu.gorsel, ISIM.gorsel, RAKAM.gorsel];
  for(const p of Object.values(HUD)) liste.push(p.gorsel);
  for(const h of Object.values(HAVAYOLLARI)) liste.push(h.dosya);
  for(const s of SEHIR_LISTE){
    for(let b=1;b<=SON_BASAMAK;b++) liste.push(parcaGorseli(s,b));
  }
  return liste;
}

function gorselleriTara(){
  const liste = beklenenGorseller();
  if(GOMULU){ liste.forEach(a=>{ if(GOMULU[a]) VAR_OLAN.add(a); }); return Promise.resolve(); }
  return Promise.all(liste.map(ad => new Promise(bitti => {
    const im = new Image();
    im.onload  = ()=>{ VAR_OLAN.add(ad); bitti(); };
    im.onerror = ()=> bitti();
    im.src = ad;
  })));
}

/* Bir parçanın görünüşü: görsel varsa <img>, yoksa geçici renkli kutu. */
function parcaIcerigi(sehir, basamak){
  const bilgi = basamakBilgisi(sehir, basamak);
  const yol = parcaGorseli(sehir, basamak);
  if(gorselVar(yol)){
    const im = document.createElement('img');
    im.src = gorselYolu(yol);
    im.alt = bilgi.ad;
    return im;
  }
  const kutu = document.createElement('div');
  kutu.className = 'parca-gecici';
  kutu.style.background = 'linear-gradient(150deg, ' + SEHIRLER[sehir].renk + ', ' + koyult(SEHIRLER[sehir].renk) + ')';
  kutu.innerHTML = '<span class="pg-tier">' + basamak + '</span>' +
                   '<span class="pg-ad">' + bilgi.ad + '</span>';
  return kutu;
}

/* Parça gerçek görselse hücrenin İÇİNDE duran bir resim gibi değil, tahtanın
   ÜSTÜNE konmuş bir nesne gibi görünmeli: altına temas gölgesi düşer ve
   hücreden biraz taşar. Geçici kutularda bu istenmiyor, o yüzden işaret. */
function gorselliMi(el){ return !!el.querySelector('img'); }

/* Geçici kutulara degrade verebilmek için rengi biraz koyultuyoruz —
   görseller gelince bu fonksiyon da kullanılmaz olacak. */
function koyult(hex){
  const n = parseInt(hex.slice(1),16);
  const r = Math.round(((n>>16)&255)*0.55), g = Math.round(((n>>8)&255)*0.55), b = Math.round((n&255)*0.55);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/* ---------- 3) DURUM + YARDIMCILAR ---------- */
const $ = s => document.querySelector(s);
const rastgele = n => Math.floor(Math.random()*n);
function karistir(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=rastgele(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

let durum = 'bas';            // bas | isim | oyun | bitiyor | bitti
let izgara = [];              // izgara[s][k] = null | {sehir, basamak, el}
let hucreEl = [];             // aynı boyutta DOM karşılıkları
let ucaklar = [];             // {sehir, kod, el}
let puan = 0, tamamlanan = 0, hatali = 0;
let baslangic = 0, kalanSn = TUR_SURESI;
let makineEl = null, kendiSaat = 0;
let stok = [];                 // makinenin dağıtacağı hediyelikler (şehir adları)

/* ---------- 4) SAHNE ÖLÇÜSÜ ----------
   Bütün ölçüler TEK bir sayıdan (hücre kenarı) türüyor. Izgara 5 hücre +
   4 boşluk + 2 kenar payı kadar yer kaplıyor (boşluk = hücrenin %10'u),
   yani genişlik = 5.6 hücre. Yüksekliğe de bakıyoruz: dar ve uzun bir
   pencerede ızgara taşmasın.                                            */
function olculeriGuncelle(){
  const sahne = $('#sahne');
  const G = sahne.clientWidth, Y = sahne.clientHeight;
  /* Tahta bir görsel olduğu için ölçüler ondan geliyor: hücre kenarı ne
     olursa olsun görsel aynı oranda büyüyor, hücreler de üstünde kayıtlı
     kalıyor. +2.9 ≈ üst bilgi + uçak kartları. */
  /* Tahta ekranın tamamını kaplamıyor: üstte manzara, tezgah ve uçaklar
     için yer kalmalı — ama fazla küçülünce de tezgahın yanında cılız
     kalıyor. %98 sahne bandını bitiriyor, %88 orantısız duruyordu. */
  const enGore  = (G * 0.94) / TAHTA_EN;
  const boyGore = (Y * 0.99) / (TAHTA_BOY + 2.9);
  const h = Math.max(28, Math.floor(Math.min(enGore, boyGore)));
  const kok = document.documentElement;
  kok.style.setProperty('--hucre', h + 'px');
  kok.style.setProperty('--gorunen', GORUNEN_UCAK);
  kok.style.setProperty('--tahta-en',  TAHTA_EN.toFixed(4));
  kok.style.setProperty('--tahta-boy', TAHTA_BOY.toFixed(4));
}

/* ---------- 5) IZGARA VE PARÇALAR ---------- */
function izgarayiKur(){
  const g = $('#izgara');
  g.innerHTML = '';
  izgara = []; hucreEl = [];
  for(let s=0;s<SATIR;s++){
    izgara.push(new Array(SUTUN).fill(null));
    hucreEl.push(new Array(SUTUN).fill(null));
    for(let k=0;k<SUTUN;k++){
      const h = document.createElement('div');
      h.className = 'hucre';
      h.dataset.s = s; h.dataset.k = k;
      /* Hücre, tahta görselindeki kutucuğun tam üstüne oturuyor. Dokunma
         alanı çizilen kutucuğun tamamı: aradaki ince boşluk da hücreye
         dahil, parmak kenara denk gelince hamle kaybolmasın. */
      h.style.left   = ((TAHTA.x0 + k*TAHTA.adimX) / TAHTA.en  * 100) + '%';
      h.style.top    = ((TAHTA.y0 + s*TAHTA.adimY) / TAHTA.boy * 100) + '%';
      h.style.width  = HUCRE_EN_YUZDE  + '%';
      h.style.height = HUCRE_BOY_YUZDE + '%';
      if(s===MAKINE_YERI.s && k===MAKINE_YERI.k) makineyiKur(h);
      g.appendChild(h);
      hucreEl[s][k] = h;
    }
  }
}

const makineHucresiMi = (s,k) => s===MAKINE_YERI.s && k===MAKINE_YERI.k;

function parcaKoy(s, k, sehir, basamak){
  const veri = { sehir, basamak, el:null };
  const el = document.createElement('div');
  el.className = 'parca';
  el.appendChild(parcaIcerigi(sehir, basamak));
  if(gorselliMi(el)) el.classList.add('gorselli');
  veri.el = el;
  izgara[s][k] = veri;
  hucreEl[s][k].appendChild(el);
  return veri;
}

function parcaSil(s,k){
  const p = izgara[s][k];
  if(p && p.el) p.el.remove();
  izgara[s][k] = null;
}

function bosHucreler(){
  const liste = [];
  for(let s=0;s<SATIR;s++) for(let k=0;k<SUTUN;k++)
    if(!makineHucresiMi(s,k) && !izgara[s][k]) liste.push({s,k});
  return liste;
}

function komsuBosHucreler(s0,k0){
  const liste = [];
  for(let ds=-1; ds<=1; ds++) for(let dk=-1; dk<=1; dk++){
    if(!ds && !dk) continue;
    const s = s0+ds, k = k0+dk;
    if(s<0||k<0||s>=SATIR||k>=SUTUN) continue;
    if(makineHucresiMi(s,k) || izgara[s][k]) continue;
    liste.push({s,k});
  }
  return liste;
}

/* ---------- 6) MAKİNE (BAGAJ BANDI) ---------- */
function makineyiKur(h){
  h.classList.add('makine');
  if(gorselVar('assets/machine.png')){
    const im = document.createElement('img');
    im.className = 'makine-gorsel';
    im.src = gorselYolu('assets/machine.png');
    im.alt = 'Bagaj bandı';
    h.appendChild(im);
  }else{
    const kutu = document.createElement('div');
    kutu.className = 'makine-gecici';
    kutu.textContent = 'BAGAJ BANDI';
    h.appendChild(kutu);
  }
  h.addEventListener('click', makineyeBas);
  makineEl = h;
}

/* MAKİNENİN STOĞU TURUN BAŞINDA SAYILIYOR.
   Her sipariş için tam TABAN_ADET (8) hediyelik konuyor: bir Paris uçuşu
   varsa 8 bere, iki Londra uçuşu varsa 16 şemsiye. Yani makineden çıkan
   her şeyin karşılığı var — ne fazlası çıkıyor ne eksiği.

   Önce rastgele seçiliyordu; o zaman bir şehrin uçağı kalktıktan sonra o
   şehirden tahtada kalanlar ölü yüke dönüşüyor, hücreleri işgal ediyor ve
   çocuğun o zincire harcadığı emek boşa gidiyordu. Sayarak dağıtınca bu
   sorun kaynağında bitiyor.

   Deste karılıyor: sırayla dağıtılsa önce sekiz bere, sonra sekiz şemsiye
   çıkar ve tahtada tek seferde tek şehir olurdu.                          */
function stokKur(){
  const liste = [];
  for(const u of ucaklar)
    for(let i = 0; i < TABAN_ADET; i++) liste.push(u.sehir);
  stok = karistir(liste);
}

/* İstenen sayıda hediyeliği makinenin çevresine döker; yer yoksa false.
   Önce komşular, komşular doluysa ızgaranın kalanı — aksi hâlde makinenin
   çevresi dolduğu anda oyun kilitlenmiş gibi hissettiriyor. */
function hediyelikDusur(adet){
  if(!stok.length) return 'stok';
  let hedef = karistir(komsuBosHucreler(MAKINE_YERI.s, MAKINE_YERI.k));
  if(hedef.length < adet){
    const kalan = karistir(bosHucreler()).filter(b => !hedef.some(h=>h.s===b.s&&h.k===b.k));
    hedef = hedef.concat(kalan);
  }
  if(!hedef.length) return 'yer';
  /* Yer ne kadarsa o kadar düşüyor; stoktan da tam o kadar eksiliyor.
     Yer yokken stoktan çekilseydi hediyelikler sessizce buharlaşır ve
     tur bitirilemez hâle gelirdi. */
  const kac = Math.min(adet, hedef.length, stok.length);
  for(let i = 0; i < kac; i++) parcaKoy(hedef[i].s, hedef[i].k, stok.pop(), 1);
  makineKipirdat();
  makineEl.classList.toggle('bos', stok.length === 0);
  return true;
}

/* Makine her döküşte kısa bir sarsılsın: hediyeliğin nereden geldiği belli
   olsun, kendiliğinden düşenler de gözden kaçmasın. */
function makineKipirdat(){
  if(!makineEl) return;
  makineEl.classList.remove('calisti');
  void makineEl.offsetWidth;              // animasyon baştan başlasın
  makineEl.classList.add('calisti');
}

function makineyeBas(){
  if(durum!=='oyun') return;
  const sonuc = hediyelikDusur(MAKINE_ADET);
  if(sonuc === 'yer')   uyari(makineEl, 'Yer yok — birleştir!');
  if(sonuc === 'stok')  uyari(makineEl, 'Hepsi çıktı — birleştir!');
  /* Elle basınca kendiliğinden düşümün sayacı da sıfırlanıyor: basışın
     hemen ardından bir tane daha düşmesi rastgele fazlalık gibi duruyor. */
  kendiSaat = performance.now();
}

/* Kendiliğinden düşüm. Tahta doluysa sessizce bekliyor — her iki saniyede
   bir uyarı baloncuğu çıkarsa ekran uyarıdan görünmez oluyor. */
function makineyiIsle(simdi){
  if(simdi - kendiSaat < MAKINE_KENDI_ARALIK) return;
  kendiSaat = simdi;
  hediyelikDusur(MAKINE_KENDI_ADET);
}

/* ---------- 7) SÜRÜKLEME ---------- */
let tasima = null;   // {s,k,sehir,basamak,el}
const surukleEl = () => $('#surukle');

function sahneKoordinati(x,y){
  const r = $('#sahne').getBoundingClientRect();
  return { x: x - r.left, y: y - r.top };
}

function tasimayaBasla(ev){
  if(durum!=='oyun') return;
  const parcaDom = ev.target.closest('.parca');
  if(!parcaDom) return;
  const hucre = parcaDom.closest('.hucre');
  const s = +hucre.dataset.s, k = +hucre.dataset.k;
  const veri = izgara[s][k];
  if(!veri) return;

  ev.preventDefault();
  tasima = { s, k, sehir:veri.sehir, basamak:veri.basamak };
  parcaDom.classList.add('tasiniyor');

  const g = surukleEl();
  g.innerHTML = '';
  g.appendChild(parcaIcerigi(veri.sehir, veri.basamak));
  g.classList.toggle('gorselli', gorselliMi(g));
  g.classList.remove('gizli');
  hayaletiTasi(ev.clientX, ev.clientY);

  window.addEventListener('pointermove', tasimaHareket);
  window.addEventListener('pointerup', tasimaBitti);
  window.addEventListener('pointercancel', tasimaBitti);
}

function hayaletiTasi(x,y){
  const p = sahneKoordinati(x,y);
  const g = surukleEl();
  g.style.left = p.x + 'px';
  g.style.top  = p.y + 'px';
}

function tasimaHareket(ev){
  if(!tasima) return;
  ev.preventDefault();
  hayaletiTasi(ev.clientX, ev.clientY);
  isaretleriTemizle();
  const alt = document.elementFromPoint(ev.clientX, ev.clientY);
  if(!alt) return;

  const ucakDom = alt.closest('.ucak');
  if(ucakDom){
    const u = ucaklar.find(x=>x.el===ucakDom);
    const uyar = u && tasima.basamak===SON_BASAMAK && u.sehir===tasima.sehir;
    ucakDom.classList.add(uyar ? 'hedef' : 'hedef-yanlis');
    return;
  }
  const hucre = alt.closest('.hucre');
  if(hucre && !hucre.classList.contains('makine')){
    const s = +hucre.dataset.s, k = +hucre.dataset.k;
    const varOlan = izgara[s][k];
    const birlesir = varOlan && varOlan.sehir===tasima.sehir && varOlan.basamak===tasima.basamak
                     && tasima.basamak < SON_BASAMAK && !(s===tasima.s && k===tasima.k);
    hucre.classList.add(birlesir ? 'birlesir' : 'uzeri');
  }
}

function isaretleriTemizle(){
  document.querySelectorAll('.hucre.uzeri, .hucre.birlesir').forEach(h=>h.classList.remove('uzeri','birlesir'));
  document.querySelectorAll('.ucak.hedef, .ucak.hedef-yanlis').forEach(u=>u.classList.remove('hedef','hedef-yanlis'));
}

function tasimaBitti(ev){
  window.removeEventListener('pointermove', tasimaHareket);
  window.removeEventListener('pointerup', tasimaBitti);
  window.removeEventListener('pointercancel', tasimaBitti);
  if(!tasima) return;

  const t = tasima; tasima = null;
  surukleEl().classList.add('gizli');
  isaretleriTemizle();
  const kaynak = izgara[t.s][t.k];
  if(kaynak && kaynak.el) kaynak.el.classList.remove('tasiniyor');

  const alt = document.elementFromPoint(ev.clientX, ev.clientY);
  if(!alt || !kaynak) return;

  const ucakDom = alt.closest('.ucak');
  if(ucakDom){ teslimEt(t, ucakDom); return; }

  const hucre = alt.closest('.hucre');
  if(!hucre || hucre.classList.contains('makine')) return;
  const s = +hucre.dataset.s, k = +hucre.dataset.k;
  if(s===t.s && k===t.k) return;

  const hedef = izgara[s][k];
  if(!hedef){ tasi(t.s,t.k,s,k); return; }

  if(hedef.sehir===t.sehir && hedef.basamak===t.basamak && t.basamak < SON_BASAMAK){
    birlestir(t.s,t.k,s,k);
  }else{
    yerDegistir(t.s,t.k,s,k);   // farklı parça: takas — hiçbir hamle boşa gitmesin
  }
}

function tasi(s1,k1,s2,k2){
  const p = izgara[s1][k1];
  izgara[s1][k1] = null;
  izgara[s2][k2] = p;
  hucreEl[s2][k2].appendChild(p.el);
}

function yerDegistir(s1,k1,s2,k2){
  const a = izgara[s1][k1], b = izgara[s2][k2];
  izgara[s1][k1] = b; izgara[s2][k2] = a;
  hucreEl[s1][k1].appendChild(b.el);
  hucreEl[s2][k2].appendChild(a.el);
}

function birlestir(s1,k1,s2,k2){
  const sehir = izgara[s2][k2].sehir, yeni = izgara[s2][k2].basamak + 1;
  parcaSil(s1,k1);
  parcaSil(s2,k2);
  const p = parcaKoy(s2,k2,sehir,yeni);
  p.el.classList.add('birlesti');
  puanEkle(PUAN_BIRLESTIR * yeni, hucreEl[s2][k2]);
}

/* ---------- 8) UÇAKLAR (SİPARİŞLER) ---------- */
/* Şehre uçan havayollarından biri. Görseli OLAN şirketler tercih ediliyor:
   uçaklar parça parça üretilirken sahnede logosuz beyaz uçaklar değil,
   hazır olan livery'ler görünsün. Hiçbirinin görseli yoksa sıradan seçim. */
function havayoluSec(sehir){
  const hepsi = SEHIRLER[sehir].havayollari;
  const hazir = hepsi.filter(h => gorselVar(HAVAYOLLARI[h].dosya));
  const havuz = hazir.length ? hazir : hepsi;
  return havuz[rastgele(havuz.length)];
}

function ucakKarti(sehir){
  const S = SEHIRLER[sehir];
  const hvId = havayoluSec(sehir);
  const hv = HAVAYOLLARI[hvId];
  const el = document.createElement('div');
  el.className = 'ucak geliyor';
  /* Giriş sınıfı kısa süre sonra kalkıyor. Sadece animationend'e
     güvenilmiyor: animasyonlar çalışmadığında (arka plandaki sekme,
     hareket azaltma) o olay hiç gelmiyor ve kart giriş karesinde donup
     tezgahın üstünde asılı kalıyordu. */
  setTimeout(() => el.classList.remove('geliyor'), 500);

  /* Uçak arkada, plaka önünde: ikisi de tezgahın yüzeyine basıyor. */
  const ucakKutu = document.createElement('div');
  ucakKutu.className = 'ucak-govde';
  const ucakYolu = gorselVar(hv.dosya) ? hv.dosya : (gorselVar(UCAK_YEDEK) ? UCAK_YEDEK : null);
  if(ucakYolu){
    const im = document.createElement('img');
    im.className = 'ucak-gorsel'; im.src = gorselYolu(ucakYolu); im.alt = hv.ad;
    ucakKutu.appendChild(im);
  }else{
    const kutu = document.createElement('div');
    kutu.className = 'ucak-gecici'; kutu.textContent = '✈';
    ucakKutu.appendChild(kutu);
  }
  el.appendChild(ucakKutu);

  /* Plaka: solda uçağın istediği bagaj, sağda uçuş kodu ve şehir.
     Okuma bilmeyen çocuk bagajın resminden anlıyor, kod ise sahneyi
     havaalanı gibi gösteriyor. */
  const plaka = document.createElement('div');
  plaka.className = 'ucak-plaka';
  /* Plakanın boyunu görselin kendisi belirliyor; yazılar da üstüne
     görselden ölçülmüş yüzdelerle biniyor. Görsel yoksa kutu kendi
     zeminini çiziyor (bkz. style.css .ucak-plaka). */
  if(gorselVar(PLAKA.gorsel)){
    const pim = document.createElement('img');
    pim.className = 'plaka-gorsel'; pim.src = gorselYolu(PLAKA.gorsel); pim.alt = '';
    plaka.appendChild(pim);
  }
  const alan = document.createElement('div');
  alan.className = 'plaka-alan';

  const bagaj = document.createElement('div');
  bagaj.className = 'plaka-bagaj';
  bagaj.appendChild(parcaIcerigi(sehir, SON_BASAMAK));
  alan.appendChild(bagaj);

  const yazi = document.createElement('div');
  yazi.className = 'plaka-yazi';
  const kod = document.createElement('div');
  kod.className = 'plaka-kod';
  kod.textContent = hv.on + S.ucuslar[rastgele(S.ucuslar.length)];
  const ad = document.createElement('div');
  ad.className = 'plaka-sehir';
  ad.textContent = S.ad;
  yazi.appendChild(kod); yazi.appendChild(ad);
  alan.appendChild(yazi);

  plaka.appendChild(alan);
  el.appendChild(plaka);

  return { sehir, havayolu:hvId, kod:kod.textContent, el };
}

/* Turun bütün siparişleri baştan belirleniyor. Şehirler karılmış destelerden
   sırayla alınıyor: saf rastgelelikte aynı şehir üst üste üç kez çıkıp
   turun yarısını tek zincire çeviriyordu. */
function siparisSehirleri(){
  const liste = [];
  while(liste.length < HEDEF_SIPARIS){
    for(const s of karistir(SEHIR_LISTE)){
      liste.push(s);
      if(liste.length >= HEDEF_SIPARIS) break;
    }
  }
  return liste;
}

function ucaklariKur(){
  const alan = $('#ucaklar');
  alan.innerHTML = '';
  ucaklar = [];
  for(const sehir of siparisSehirleri()){
    const u = ucakKarti(sehir);
    ucaklar.push(u);
    alan.appendChild(u.el);
  }
  alan.scrollLeft = 0;
}

function teslimEt(t, ucakDom){
  const u = ucaklar.find(x=>x.el===ucakDom);
  if(!u) return;
  if(t.basamak !== SON_BASAMAK){ uyari(ucakDom, 'Önce bagaj yap'); return; }
  if(u.sehir !== t.sehir){
    /* Hazır bir bagajın yanlış uçağa götürülmesi "hatalı deneme". Bagaj
       olmayan bir parçayı uçağa sürüklemek sayılmıyor: o hata değil,
       çocuğun oyunu keşfetmesi. */
    hatali++;
    uyari(ucakDom, 'Bu uçak ' + SEHIRLER[u.sehir].ad + '\'e gidiyor');
    return;
  }

  parcaSil(t.s, t.k);
  tamamlanan++;
  puanEkle(PUAN_SIPARIS, ucakDom);
  hudGuncelle();

  /* Uçak kalkar ve listeden çıkar: turun siparişleri baştan belli, yerine
     yenisi gelmiyor. Şerit kendiliğinden kayarak boşluğu kapatıyor. */
  ucaklar.splice(ucaklar.indexOf(u), 1);
  u.el.classList.add('kalkiyor');
  setTimeout(()=> u.el.remove(), 700);

  if(tamamlanan >= HEDEF_SIPARIS){
    /* Sayaç HEMEN dursun: uçağın kalkış animasyonu sürerken saniyeler
       işlemeye devam edip kazanılan bonusu yiyordu. */
    durum = 'bitiyor';
    setTimeout(oyunuBitir, 800);
  }
}

/* ---------- İSİM GİRİŞİ ---------- */
/* Görselin üstüne oturan her şey aynı yardımcıyla yerleştiriliyor: kutunun
   yüzdesi, görselin piksel ölçüsünden hesaplanıyor. */
function isimYerlestir(el, a){
  el.style.left   = (a.x   / ISIM.en  * 100) + '%';
  el.style.top    = (a.y   / ISIM.boy * 100) + '%';
  el.style.width  = (a.en  / ISIM.en  * 100) + '%';
  el.style.height = (a.boy / ISIM.boy * 100) + '%';
}

function isimEkraniniKur(){
  if(!gorselVar(ISIM.gorsel)) return false;
  const sahne = $('#isimSahne');
  if(sahne.querySelector('.tus-hit')) return true;      // bir kez kurulur

  const yol = gorselYolu(ISIM.gorsel);
  $('#isimImg').src = yol;
  $('#isimBg').src  = yol;
  isimYerlestir($('#isimBaslik'), ISIM.baslik);
  isimYerlestir($('#isimYazi'), ISIM.kutu);
  isimYerlestir($('#isimButon'), ISIM.buton);

  const tus = (alan, etiket, isle) => {
    const b = document.createElement('button');
    b.className = 'tus-hit'; b.type = 'button';
    isimYerlestir(b, alan);
    b.setAttribute('aria-label', etiket);
    b.addEventListener('click', isle);
    sahne.appendChild(b);
  };
  const p = ISIM.tusPayi;
  for(const satir of ISIM.satirlar)
    for(const [harf, x, en] of satir.tuslar)
      tus({ x:x-p, y:satir.y-p, en:en+2*p, boy:satir.boy+2*p }, harf, ()=> adYaz(harf));
  tus(ISIM.sil,    'Sil',    adSil);
  tus(ISIM.bosluk, 'Boşluk', ()=> adYaz(' '));
  tus(ISIM.buton,  'Başla',  isimOnayla);
  return true;
}

function adGuncelle(){
  $('#isimMetin').textContent = yazilanAd;
  /* Yeterli harf girilmeden buton sönük: çocuk boş isimle başlayıp skor
     tablosunda kendini bulamasın. */
  $('#isimButon').classList.toggle('sonuk', yazilanAd.trim().length < AD_MIN);
}
function adYaz(harf){
  if(yazilanAd.length >= AD_MAX) return;
  /* Baştan ya da arka arkaya boşluk kabul edilmiyor */
  if(harf === ' ' && (!yazilanAd || yazilanAd.endsWith(' '))) return;
  yazilanAd += harf; adGuncelle();
}
function adSil(){ yazilanAd = yazilanAd.slice(0, -1); adGuncelle(); }

function isimEkraniniAc(){
  durum = 'isim';
  yazilanAd = '';
  adGuncelle();
  $('#basScreen').classList.add('gizli');
  $('#bitScreen').classList.add('gizli');
  if(isimEkraniniKur()) $('#isimScreen').classList.remove('gizli');
  else oyunuBaslat();          // görsel yoksa isim adımını atla
}

function isimOnayla(){
  if(yazilanAd.trim().length < AD_MIN) return;
  $('#isimScreen').classList.add('gizli');
  oyunuBaslat();
}

/* Geliştirirken fiziksel klavyeyle de yazılabilsin; kioskta klavye yok. */
function isimTusu(e){
  if(durum !== 'isim') return;
  if(e.key === 'Backspace'){ adSil(); e.preventDefault(); return; }
  if(e.key === 'Enter'){ isimOnayla(); return; }
  if(e.key.length === 1) adYaz(e.key.toLocaleUpperCase('tr'));
}

/* ---------- SKOR TABLOSU ---------- */
/* Oyuncular tarayıcıda saklanıyor. Anahtar sürümlü: tablonun yapısı
   değişirse anahtar artırılır ve eski kayıt görmezden gelinir. */
const SKOR_ANAHTAR = 'bm_skor1';
const SKOR_SATIR = 5;          // panele sığan satır sayısı

function skorlariOku(){
  try{ const r = localStorage.getItem(SKOR_ANAHTAR); if(r) return JSON.parse(r); }catch(e){}
  return [];
}
function skorEkle(ad, p){
  const liste = skorlariOku();
  liste.push({ ad, puan:p });
  liste.sort((a,b)=> b.puan - a.puan);
  const kirpik = liste.slice(0, 20);
  try{ localStorage.setItem(SKOR_ANAHTAR, JSON.stringify(kirpik)); }catch(e){}
  return kirpik;
}
function skorTablosunuCiz(liste, vurgulaAd, vurgulaPuan){
  const kap = $('#bitTablo');
  kap.innerHTML = '';
  let vuruldu = false;
  liste.slice(0, SKOR_SATIR).forEach((k, i) => {
    const satir = document.createElement('div');
    satir.className = 'skor-satir';
    /* Bu turun kaydı bir kez işaretleniyor: aynı ad ve puan tabloda birden
       fazla olabilir, hepsi vurgulanırsa hangisinin bu tur olduğu kaybolur. */
    if(!vuruldu && k.ad === vurgulaAd && k.puan === vurgulaPuan){
      satir.classList.add('benim'); vuruldu = true;
    }
    satir.innerHTML = '<span class="skor-sira oyun-yazi">' + (i+1) + '</span>' +
                      '<span class="skor-ad oyun-yazi"></span>' +
                      '<span class="skor-puan"></span>';
    satir.querySelector('.skor-ad').textContent = k.ad;
    sayiYaz(satir.querySelector('.skor-puan'), k.puan);
    kap.appendChild(satir);
  });
}

/* ---------- 9) AKIŞ ---------- */
function puanEkle(p, yakinEl){
  puan += p;
  hudGuncelle();
  baloncuk(yakinEl, '+' + p, '');
}

function uyari(yakinEl, yazi){ baloncuk(yakinEl, yazi, 'uyari'); }

function baloncuk(yakinEl, yazi, sinif){
  if(!yakinEl) return;
  const sahneR = $('#sahne').getBoundingClientRect();
  const r = yakinEl.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'baloncuk ' + sinif;
  b.textContent = yazi;
  b.style.left = (r.left + r.width/2 - sahneR.left) + 'px';
  b.style.top  = (r.top  + r.height/2 - sahneR.top) + 'px';
  $('#baloncuklar').appendChild(b);
  setTimeout(()=>b.remove(), 950);
}

function sureYazi(sn){
  return String(Math.floor(sn/60)).padStart(2,'0') + ':' + String(sn%60).padStart(2,'0');
}

function hudGuncelle(){
  sayiYaz($('#hudSiparis'), tamamlanan + '/' + HEDEF_SIPARIS);
  sayiYaz($('#hudPuan'), puan);
  sayiYaz($('#hudSure'), sureYazi(kalanSn));
  /* Son saniyelerde sayaç kırmızıya dönüp nabız atıyor: çocuk saati
     okumasa da acele etmesi gerektiğini görüyor. */
  const kutu = $('#hudSure').closest('.hud-kutu');
  if(kutu) kutu.classList.toggle('az-kaldi', durum === 'oyun' && kalanSn <= AZ_KALDI);
}

function oyunuBaslat(){
  durum = 'oyun';
  puan = 0; tamamlanan = 0; hatali = 0; kalanSn = TUR_SURESI;
  baslangic = performance.now();

  $('#basScreen').classList.add('gizli');
  $('#bitScreen').classList.add('gizli');

  izgarayiKur();
  ucaklariKur();
  stokKur();               // sipariş listesi belli olduktan SONRA sayılır
  hudGuncelle();

  /* Boş bir matris karşılamasın: makine bir kez kendiliğinden çalışsın. */
  kendiSaat = performance.now();
  makineyeBas();
}

/* Bitiş görselini seçip rakam kutularını onun üstüne oturtur. Görsel yoksa
   geçici panel devrede kalıyor — süre dolan hâlin tasarımı henüz gelmedi. */
function bitisGorseliniKur(basarili){
  const tasarim = basarili ? BITIS.basarili : BITIS.sureDoldu;
  const ad = tasarim.gorsel;
  if(!gorselVar(ad)){
    document.body.classList.remove('sanat-bitis');
    $('#bitGecici').classList.remove('gizli');
    return false;
  }
  const yol = gorselYolu(ad);
  $('#bitImg').src = yol;
  $('#bitBg').src  = yol;
  $('#bitGecici').classList.add('gizli');
  document.body.classList.add('sanat-bitis');

  const kok = document.documentElement;
  kok.style.setProperty('--bitis-oran', (BITIS.en / BITIS.boy).toFixed(5));
  const yerlestir = (el, a) => {
    el.style.left   = (a.x   / BITIS.en  * 100) + '%';
    el.style.top    = (a.y   / BITIS.boy * 100) + '%';
    el.style.width  = (a.en  / BITIS.en  * 100) + '%';
    el.style.height = (a.boy / BITIS.boy * 100) + '%';
  };
  for(const [id, alan] of Object.entries(tasarim.alanlar)) yerlestir($('#' + id), alan);
  yerlestir($('#bitTablo'), tasarim.tablo);
  return true;
}

/* Rakamı kutusuna sığdırır. Sabit bir punto işe yaramıyor: sütunlar farklı
   genişlikte ve içerik de değişken — "6" ile "00:47" aynı kutuya sığmıyor.
   Önce kutu boyuna göre bir punto veriliyor, taşıyorsa oranla küçültülüyor. */
function yaziyiSigdir(el){
  const kutu = el.getBoundingClientRect();
  if(!kutu.height) return;
  /* Kutunun tamamını doldurmuyor: rakam sütuna sıkışmış görünmesin diye
     hem boyca hem ence pay bırakılıyor. Önce %80'di ve dört haneli puan
     ile "00:52" sütunun kenarlarına dayanıyordu. */
  let boy = kutu.height * 0.56;
  el.style.fontSize = boy + 'px';
  const kullanilabilir = el.clientWidth * 0.80;      // yanlardan pay
  const tasma = el.scrollWidth / kullanilabilir;
  if(tasma > 1) el.style.fontSize = (boy / tasma) + 'px';
}

function oyunuBitir(){
  if(durum === 'bitti') return;          // hem süre bitişi hem son teslimat çağırabilir
  durum = 'bitti';
  /* Artan süre puana dönüşüyor: erken bitirmenin ödülü bu. Süre dolduysa
     kalan sıfır, bonus da yok. */
  puan += kalanSn * PUAN_KALAN_SANIYE;
  const basarili = tamamlanan >= HEDEF_SIPARIS;

  bitisGorseliniKur(basarili);

  /* Görseldeki dört sütun: toplam puan, hatalı deneme, doğru eşleşme,
     kalan süre. */
  sayiYaz($('#bitPuan'),   puan);
  sayiYaz($('#bitHatali'), hatali);
  sayiYaz($('#bitDogru'),  tamamlanan);
  sayiYaz($('#bitSure'),   sureYazi(kalanSn));

  /* Görsel yokken görünen yedek panel */
  $('#bitBaslik').textContent = basarili ? 'TEBRİKLER' : 'SÜRE DOLDU';
  $('#bitSiparis').textContent = tamamlanan + '/' + HEDEF_SIPARIS;
  $('#bitSureYedek').textContent = sureYazi(kalanSn);
  $('#bitPuanYedek').textContent = puan;

  skorTablosunuCiz(skorEkle(yazilanAd || 'OYUNCU', puan), yazilanAd, puan);
  $('#bitScreen').classList.remove('gizli');
  /* Ölçüm ancak ekran görünürken doğru: gizliyken kutuların boyu sıfır. */
  Object.keys(BITIS.basarili.alanlar).forEach(id => yaziyiSigdir($('#' + id)));
}

/* Bitiş ekranındaki buton "ANA SAYFA" diyor: tura doğrudan başlamak yerine
   başlangıç ekranına dönüyor. Kioskta doğru olan da bu — sıradaki çocuk
   oyunu baştan, nasıl oynanır anlatımıyla karşılıyor. */
function anaSayfayaDon(){
  durum = 'bas';
  $('#bitScreen').classList.add('gizli');
  $('#basScreen').classList.remove('gizli');
}

function dongu(simdi){
  if(durum==='oyun'){
    makineyiIsle(simdi);
    const kalan = Math.max(0, TUR_SURESI - Math.floor((simdi - baslangic)/1000));
    if(kalan !== kalanSn){
      kalanSn = kalan;
      hudGuncelle();
      if(kalanSn === 0) oyunuBitir();
    }
  }
  requestAnimationFrame(dongu);
}

/* Tasarım görselleri assets/ içine düşünce geçici paneller kendiliğinden
   kalkar; kod tarafında yapılacak bir şey yok. */
function katmanGorseli(gorselAd, imgId, bgId, geciciId){
  if(!gorselVar(gorselAd)) return;
  const y = gorselYolu(gorselAd);
  $(imgId).src = y;
  $(bgId).src = y;
  $(geciciId).classList.add('gizli');
}

/* Tahta görseli geldiğinde kodun kendi çizdiği tepsi ve hücre zeminleri
   çekilir; görsel yoksa oyun yine oynanabilir kalsın diye onlar duruyor. */
/* Panelin görselini ve sayı alanını yerine oturtur.

   Görsel, KASASI kutuyu tam dolduracak şekilde ölçekleniyor: bunun için
   kutudan taşacak kadar büyütülüp negatif konumla kaydırılıyor (şeffaf pay
   dışarıda kalıyor, taşan simge görünür kalsın diye kırpma yok). Sayı alanı
   da aynı ölçekle hesaplanıp kutunun yüzdesi olarak yazılıyor.            */
function hudPaneliKur(kutu, p){
  const gorselEn = p.en / p.cerceve.en * 100;          // kutunun yüzdesi
  const gorselBoy = p.boy / p.cerceve.boy * 100;
  const gorselSol = -p.cerceve.x / p.cerceve.en * 100;
  const gorselUst = -p.cerceve.y / p.cerceve.boy * 100;

  const im = kutu.querySelector('.hud-gorsel');
  im.src = gorselYolu(p.gorsel);
  im.style.left = gorselSol + '%';  im.style.top    = gorselUst + '%';
  im.style.width = gorselEn + '%';  im.style.height = gorselBoy + '%';

  const deger = kutu.querySelector('.hud-deger');
  deger.style.left   = (gorselSol + p.alan.x   / p.en  * gorselEn)  + '%';
  deger.style.top    = (gorselUst + p.alan.y   / p.boy * gorselBoy) + '%';
  deger.style.width  = (p.alan.en  / p.en  * gorselEn)  + '%';
  deger.style.height = (p.alan.boy / p.boy * gorselBoy) + '%';
}

function hudGorselleri(){
  const kutular = document.querySelectorAll('.hud-kutu');
  let hepsiVar = true;
  kutular.forEach(kutu => { if(!gorselVar(HUD[kutu.dataset.hud].gorsel)) hepsiVar = false; });
  if(!hepsiVar) return;      // eksikse hiçbiri kullanılmasın, sıra bozulmasın
  kutular.forEach(kutu => hudPaneliKur(kutu, HUD[kutu.dataset.hud]));
  document.documentElement.style.setProperty('--hud-oran', HUD_ORAN);
  document.body.classList.add('sanat-hud');
}

function tahtaGorselleri(){
  hudGorselleri();
  if(gorselVar(TAHTA.gorsel)){
    document.documentElement.style.setProperty('--tahta-gorsel',
      'url(' + gorselYolu(TAHTA.gorsel) + ')');
    document.body.classList.add('sanat-tahta');
  }
  if(gorselVar(MANZARA)){
    $('#manzara').src = gorselYolu(MANZARA);
    document.body.classList.add('sanat-manzara');
  }
  if(gorselVar(TEZGAH.gorsel)){
    $('#tezgahImg').src = gorselYolu(TEZGAH.gorsel);
    document.body.classList.add('sanat-tezgah');
    /* Uçak yuvaları tezgahın yüzeyine otursun: yükseklik görselden ölçüldü */
    document.documentElement.style.setProperty('--tezgah-zemin', TEZGAH_ZEMIN.toFixed(2) + '%');
    document.documentElement.style.setProperty('--tezgah-alt', (-TEZGAH_ALT).toFixed(2) + '%');
  }
  if(gorselVar(PLAKA.gorsel)){
    const kok = document.documentElement;
    kok.style.setProperty('--plaka-x', PLAKA.alanX + '%');
    kok.style.setProperty('--plaka-y', PLAKA.alanY + '%');
    kok.style.setProperty('--plaka-en', PLAKA.alanEn + '%');
    kok.style.setProperty('--plaka-boy', PLAKA.alanBoy + '%');
    document.body.classList.add('sanat-plaka');
  }
}

function kur(){
  olculeriGuncelle();
  tahtaGorselleri();
  window.addEventListener('resize', olculeriGuncelle);

  katmanGorseli('assets/home_page.png', '#basImg', '#basBg', '#basGecici');

  $('#izgara').addEventListener('pointerdown', tasimayaBasla);
  $('#basBtn').addEventListener('click', isimEkraniniAc);
  window.addEventListener('keydown', isimTusu);
  $('#bitBtn').addEventListener('click', anaSayfayaDon);

  izgarayiKur();       // arka planda duran boş matris (başlangıç ekranının altında)
  requestAnimationFrame(dongu);
}

gorselleriTara().then(kur);

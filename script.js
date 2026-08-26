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
/* Tahta 5x6'dan 7x9'a çıktı: 30 hücre yerine 63. Aynı hızda hediyelik
   düşürünce tahta bir türlü dolmuyor ve oyun yavaş hissettiriyordu, o
   yüzden makine hem daha sık hem daha çok veriyor. */
const MAKINE_BEKLEME = 1200;   // ms — arka arkaya basıp matrisi tıkamasın
const MAKINE_ADET = 3;         // her basışta düşen hediyelik

const HEDEF_SIPARIS = 10;      // bu kadar bagaj teslim edilince oyun biter
/* Siparişlerin HEPSİ tezgahta duruyor; tezgah yana kaydırılıyor. Bu sayı
   aynı anda kaç tanesinin ekrana sığdığı — kaydırma adımı da bu. */
const GORUNEN_UCAK = 3;

const PUAN_SIPARIS = 150;
const PUAN_BIRLESTIR = 10;     // × ulaşılan basamak
/* Süre canı yakmıyor, sadece bitişte bonusa dönüşüyor: çocuk acele etmek
   ZORUNDA olmasın ama hızlı oynayan da ödüllendirilsin.                 */
const HIZ_BONUS_TAVAN = 300;   // saniye

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
  const liste = ['assets/machine.png','assets/home_page.png','assets/end_page.png',
                 TAHTA.gorsel, TEZGAH.gorsel, PLAKA.gorsel, MANZARA, UCAK_YEDEK];
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

let durum = 'bas';            // bas | oyun | bitti
let izgara = [];              // izgara[s][k] = null | {sehir, basamak, el}
let hucreEl = [];             // aynı boyutta DOM karşılıkları
let ucaklar = [];             // {sehir, kod, el}
let puan = 0, tamamlanan = 0;
let baslangic = 0, gecenSn = 0;
let makineHazir = true, makineAnI = 0, makineEl = null, dolumEl = null;

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
  h.classList.add('makine','hazir');
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
  const dolum = document.createElement('div');
  dolum.className = 'makine-dolum';
  dolum.innerHTML = '<i></i>';
  h.appendChild(dolum);
  h.addEventListener('click', makineyeBas);
  makineEl = h;
  dolumEl = dolum.firstElementChild;
}

/* Makine sadece MASADAKİ siparişlerin şehirlerinden hediyelik düşürür.
   Yoksa çocuk hiçbir uçağın istemediği bir zinciri büyütür ve emeği boşa
   gider — kiosk oyununda en can sıkıcı şey bu olurdu.                   */
function aktifSehir(){
  const havuz = ucaklar.map(u=>u.sehir);
  return havuz.length ? havuz[rastgele(havuz.length)] : SEHIR_LISTE[rastgele(SEHIR_LISTE.length)];
}

function makineyeBas(){
  if(durum!=='oyun' || !makineHazir) return;
  /* Önce komşular; komşular doluysa ızgaranın kalanına dağıt. Aksi hâlde
     makinenin çevresi dolduğu anda oyun kilitlenmiş gibi hissettiriyor. */
  let hedef = karistir(komsuBosHucreler(MAKINE_YERI.s, MAKINE_YERI.k));
  if(hedef.length < MAKINE_ADET){
    const kalan = karistir(bosHucreler()).filter(b => !hedef.some(h=>h.s===b.s&&h.k===b.k));
    hedef = hedef.concat(kalan);
  }
  if(!hedef.length){ uyari(makineEl, 'Yer yok — birleştir!'); return; }

  hedef.slice(0, MAKINE_ADET).forEach(h => parcaKoy(h.s, h.k, aktifSehir(), 1));
  makineHazir = false;
  makineAnI = performance.now();
  makineEl.classList.remove('hazir');
}

function makineyiIsle(simdi){
  if(makineHazir) return;
  const oran = Math.min(1, (simdi - makineAnI) / MAKINE_BEKLEME);
  dolumEl.style.width = (oran*100) + '%';
  if(oran >= 1){
    makineHazir = true;
    makineEl.classList.add('hazir');
    dolumEl.style.width = '100%';
  }
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
  if(u.sehir !== t.sehir){ uyari(ucakDom, 'Bu uçak ' + SEHIRLER[u.sehir].ad + '\'e gidiyor'); return; }

  parcaSil(t.s, t.k);
  tamamlanan++;
  puanEkle(PUAN_SIPARIS, ucakDom);
  hudGuncelle();

  /* Uçak kalkar ve listeden çıkar: turun siparişleri baştan belli, yerine
     yenisi gelmiyor. Şerit kendiliğinden kayarak boşluğu kapatıyor. */
  ucaklar.splice(ucaklar.indexOf(u), 1);
  u.el.classList.add('kalkiyor');
  setTimeout(()=> u.el.remove(), 700);

  if(tamamlanan >= HEDEF_SIPARIS) setTimeout(oyunuBitir, 800);
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
  $('#hudSiparis').textContent = tamamlanan + '/' + HEDEF_SIPARIS;
  $('#hudPuan').textContent = puan;
  $('#hudSure').textContent = sureYazi(gecenSn);
}

function oyunuBaslat(){
  durum = 'oyun';
  puan = 0; tamamlanan = 0; gecenSn = 0;
  baslangic = performance.now();
  makineHazir = true; makineAnI = 0;

  $('#basScreen').classList.add('gizli');
  $('#bitScreen').classList.add('gizli');

  izgarayiKur();
  ucaklariKur();
  hudGuncelle();
  if(dolumEl) dolumEl.style.width = '100%';

  /* Boş bir matris karşılamasın: makine bir kez kendiliğinden çalışsın. */
  makineyeBas();
  makineHazir = true;
  makineEl.classList.add('hazir');
}

function oyunuBitir(){
  durum = 'bitti';
  const bonus = Math.max(0, HIZ_BONUS_TAVAN - gecenSn) * 2;
  puan += bonus;
  $('#bitSiparis').textContent = tamamlanan;
  $('#bitSure').textContent = sureYazi(gecenSn);
  $('#bitPuan').textContent = puan;
  $('#bitScreen').classList.remove('gizli');
}

function dongu(simdi){
  if(durum==='oyun'){
    makineyiIsle(simdi);
    const sn = Math.floor((simdi - baslangic)/1000);
    if(sn !== gecenSn){ gecenSn = sn; hudGuncelle(); }
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
function tahtaGorselleri(){
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
  katmanGorseli('assets/end_page.png',  '#bitImg', '#bitBg', '#bitGecici');

  $('#izgara').addEventListener('pointerdown', tasimayaBasla);
  $('#basBtn').addEventListener('click', oyunuBaslat);
  $('#bitBtn').addEventListener('click', oyunuBaslat);

  izgarayiKur();       // arka planda duran boş matris (başlangıç ekranının altında)
  requestAnimationFrame(dongu);
}

gorselleriTara().then(kur);

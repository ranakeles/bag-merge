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
const UCAK_SAYISI = 3;         // aynı anda bekleyen sipariş

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

   "renk" yalnızca görsel HENÜZ YOKKEN çizilen geçici kutunun rengi. */
const SEHIRLER = {
  paris: {
    ad:'Paris', kod:'CDG', renk:'#C0392B',
    ucuslar:['TK1823','TK1827','TK1831'],
    zincir:[
      { ad:'Bere',         dosya:'item_paris1_bere.png' },
      { ad:'Kruvasan',     dosya:'item_paris2_croissant.png' },
      { ad:'Eyfel Kulesi', dosya:'item_paris3_eiffel.png' },
      { ad:'Paris Bagajı', dosya:'item_paris4_luggage.png' }
    ]
  },
  newyork: {
    ad:'New York', kod:'JFK', renk:'#2E86C1',
    ucuslar:['TK0003','TK0011','TK0455'],
    zincir:[
      { ad:'Güneş Gözlüğü',      dosya:'item_newyork1_sunglasses.png' },
      { ad:'Hot Dog',            dosya:'item_newyork2_hotdog.png' },
      { ad:'Özgürlük Heykeli',   dosya:'item_newyork3_statue.png' },
      { ad:'New York Bagajı',    dosya:'item_newyork4_luggage.png' }
    ]
  },
  roma: {
    ad:'Roma', kod:'FCO', renk:'#D35400',
    ucuslar:['TK1861','TK1863','TK1867'],
    zincir:[
      { ad:'Şapka',        dosya:'item_roma1_hat.png' },
      { ad:'Pizza Dilimi', dosya:'item_roma2_pizza.png' },
      { ad:'Kolezyum',     dosya:'item_roma3_colosseum.png' },
      { ad:'Roma Bagajı',  dosya:'item_roma4_luggage.png' }
    ]
  },
  londra: {
    ad:'Londra', kod:'LHR', renk:'#1F618D',
    ucuslar:['TK1979','TK1981','TK1987'],
    zincir:[
      { ad:'Şemsiye',           dosya:'item_londra1_umbrella.png' },
      { ad:'Çift Katlı Otobüs', dosya:'item_londra2_bus.png' },
      { ad:'Big Ben',           dosya:'item_londra3_bigben.png' },
      { ad:'Londra Bagajı',     dosya:'item_londra4_luggage.png' }
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
  const liste = ['assets/machine.png','assets/ucak.png','assets/home_page.png','assets/end_page.png',
                 TAHTA.gorsel];
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
  const enGore  = (G * 0.98) / TAHTA_EN;
  const boyGore = (Y * 0.99) / (TAHTA_BOY + 2.9);
  const h = Math.max(28, Math.floor(Math.min(enGore, boyGore)));
  const kok = document.documentElement;
  kok.style.setProperty('--hucre', h + 'px');
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
function ucakKarti(sehir){
  const S = SEHIRLER[sehir];
  const el = document.createElement('div');
  el.className = 'ucak geliyor';

  if(gorselVar('assets/ucak.png')){
    const im = document.createElement('img');
    im.className = 'ucak-gorsel'; im.src = gorselYolu('assets/ucak.png'); im.alt = '';
    el.appendChild(im);
  }else{
    const kutu = document.createElement('div');
    kutu.className = 'ucak-gecici'; kutu.textContent = '✈';
    el.appendChild(kutu);
  }

  const kod = document.createElement('div');
  kod.className = 'ucak-kod';
  kod.textContent = S.ucuslar[rastgele(S.ucuslar.length)];
  el.appendChild(kod);

  const ad = document.createElement('div');
  ad.className = 'ucak-sehir';
  ad.textContent = S.ad;
  el.appendChild(ad);

  /* Rozet = uçağın istediği bagajın küçük hâli. Okuma bilmeyen çocuk da
     hangi uçağa ne götüreceğini buradan anlıyor. */
  const rozet = document.createElement('div');
  rozet.className = 'ucak-rozet';
  rozet.appendChild(parcaIcerigi(sehir, SON_BASAMAK));
  el.appendChild(rozet);

  return { sehir, kod:kod.textContent, el };
}

function yeniSehirSec(){
  /* Masadaki üç sipariş farklı şehirlerden olsun: aynı şehirden iki uçak
     varsa çocuk bagajı yanlış olana bırakıp haksız yere "yanlış" duyuyor. */
  const kullanilan = ucaklar.map(u=>u.sehir);
  const bos = SEHIR_LISTE.filter(s=>!kullanilan.includes(s));
  const havuz = bos.length ? bos : SEHIR_LISTE;
  return havuz[rastgele(havuz.length)];
}

function ucaklariKur(){
  const alan = $('#ucaklar');
  alan.innerHTML = '';
  ucaklar = [];
  for(let i=0;i<UCAK_SAYISI;i++){
    const u = ucakKarti(yeniSehirSec());
    ucaklar.push(u);
    alan.appendChild(u.el);
  }
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

  /* Uçak kalkar, yeri boş kalmasın diye hemen yenisi iner. Kart yerinde
     değiştiriliyor (silinip eklenmiyor) ki üçlü dizilim oynamasın.      */
  const yer = ucaklar.indexOf(u);
  u.el.classList.add('kalkiyor');
  const eski = u.el;
  setTimeout(()=>{
    if(durum!=='oyun'){ eski.remove(); return; }
    const yeni = ucakKarti(yeniSehirSec());
    eski.replaceWith(yeni.el);
    ucaklar[yer] = yeni;
  }, 700);

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
  if(!gorselVar(TAHTA.gorsel)) return;
  document.documentElement.style.setProperty('--tahta-gorsel',
    'url(' + gorselYolu(TAHTA.gorsel) + ')');
  document.body.classList.add('sanat-tahta');
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

/* SCV Saha — test koşum ortamı.
 *
 * Uygulama tek bir HTML dosyası ve bir <script> bloğu; ayrı modül yok, bu yüzden
 * fonksiyonlara ulaşmanın yolu betiği sahte bir tarayıcı ortamında çalıştırmak.
 * Burada kurulan sahteler "çalışsın da geçsin" değil, DAVRANIŞI KORUYACAK kadar
 * gerçekçi olmalı: DOM sorguları düğüm döndürmezse render fonksiyonları sessizce
 * erken çıkar ve test hiçbir şeyi doğrulamamış olur.
 *
 * Kullanım:
 *   const { kur } = require('./harness');
 *   const app = kur();               // boş state
 *   app.state.tarlalar.push({...});
 *   app.hesaplaRozetler();
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_YOLU = path.join(__dirname, '..', 'scv-saha-v1.html');

/* ---- Sahte DOM ----
   Gerçek düğüm nesneleri döndürür: classList/style/dataset/children hepsi
   çalışır durumda. innerHTML yazılan HTML metni saklanır (testler içeriğini
   inceleyebilsin), ama ayrıştırılmaz — DOM ağacı kurmak gerekmiyor. */
function dugumYap(etiket, belge) {
  const dugum = {
    tagName: String(etiket || 'div').toUpperCase(),
    nodeName: String(etiket || 'div').toUpperCase(),
    _innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    title: '',
    children: [],
    childNodes: [],
    parentNode: null,
    ownerDocument: belge,
    style: {},
    dataset: {},
    attributes: {},
    classList: (function () {
      const kume = new Set();
      return {
        add: (...c) => c.forEach(x => kume.add(x)),
        remove: (...c) => c.forEach(x => kume.delete(x)),
        contains: c => kume.has(c),
        toggle: (c, zorla) => {
          const olsun = zorla === undefined ? !kume.has(c) : !!zorla;
          if (olsun) kume.add(c); else kume.delete(c);
          return olsun;
        },
        _kume: kume,
      };
    })(),
    setAttribute(ad, deger) { this.attributes[ad] = String(deger); },
    getAttribute(ad) { return ad in this.attributes ? this.attributes[ad] : null; },
    removeAttribute(ad) { delete this.attributes[ad]; },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    removeChild(c) {
      this.children = this.children.filter(x => x !== c);
      this.childNodes = this.childNodes.filter(x => x !== c);
      return c;
    },
    insertAdjacentHTML(_konum, html) { this._innerHTML += html; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, showPicker() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    // Node.contains: testte odaklanmış öğe olmadığı için hep false — render
    // fonksiyonları "kullanıcı yazmıyor" dalına girer, yani çizim yapılır.
    contains(baska) { return baska === this; },
    matches() { return false; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
  };
  Object.defineProperty(dugum, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = String(v); },
    enumerable: true,
  });
  /* Uygulama düğüm içeriğini yer yer firstChild üzerinden değiştiriyor
     (ör. tema düğmesindeki emoji). Çocuk yoksa boş bir metin düğümü yaratılır,
     böylece yazma denemesi patlamak yerine gerçek tarayıcıdaki gibi işler. */
  Object.defineProperty(dugum, 'firstChild', {
    get() {
      if (!this.childNodes.length) this.appendChild(dugumYap('#text', belge));
      return this.childNodes[0];
    },
    enumerable: true,
  });
  Object.defineProperty(dugum, 'lastChild', {
    get() { return this.childNodes[this.childNodes.length - 1] || null; },
    enumerable: true,
  });
  Object.defineProperty(dugum, 'className', {
    get() { return [...this.classList._kume].join(' '); },
    set(v) {
      this.classList._kume.clear();
      String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList._kume.add(c));
    },
    enumerable: true,
  });
  return dugum;
}

function belgeYap() {
  const idHaritasi = new Map();
  const belge = {
    _idHaritasi: idHaritasi,
    documentElement: null,
    body: null,
    head: null,
    visibilityState: 'visible',
    readyState: 'complete',
    /* Bilinmeyen id istendiğinde null DEĞİL, yeni bir düğüm döndürülür ve
       saklanır. Uygulama yüzlerce id'ye dokunuyor; her birini elle tanımlamak
       yerine ilk erişimde yaratmak testleri kısa tutuyor. Bir testin gerçekten
       "bu öğe yok" demesi gerekirse silById ile kaldırılabilir. */
    getElementById(id) {
      if (!idHaritasi.has(id)) {
        const d = dugumYap('div', belge);
        d.id = id;
        idHaritasi.set(id, d);
      }
      return idHaritasi.get(id);
    },
    silById(id) { idHaritasi.delete(id); },
    createElement(etiket) { return dugumYap(etiket, belge); },
    createTextNode(m) { const d = dugumYap('#text', belge); d.textContent = String(m); return d; },
    createDocumentFragment() { return dugumYap('#fragment', belge); },
    querySelector(sec) {
      const m = /^#([\w-]+)$/.exec(sec || '');
      return m ? belge.getElementById(m[1]) : null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
  };
  belge.documentElement = dugumYap('html', belge);
  belge.body = dugumYap('body', belge);
  belge.head = dugumYap('head', belge);
  return belge;
}

/* ---- Sahte localStorage ---- */
function depoYap(baslangic) {
  const harita = new Map(Object.entries(baslangic || {}));
  return {
    _harita: harita,
    /* Kota taşmasını taklit etmek için: kotaAsimi = true yapılınca setItem
       tarayıcının attığı QuotaExceededError'ın aynısını atar. */
    kotaAsimi: false,
    getItem(k) { return harita.has(k) ? harita.get(k) : null; },
    setItem(k, v) {
      if (this.kotaAsimi) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        throw e;
      }
      harita.set(k, String(v));
    },
    removeItem(k) { harita.delete(k); },
    clear() { harita.clear(); },
    key(i) { return [...harita.keys()][i] ?? null; },
    get length() { return harita.size; },
  };
}

/* ---- Sahte Firebase (compat API'sinin kullanılan yüzeyi) ----
   Yazılan işlemleri kaydeder ki testler "ne gönderildi" diye bakabilsin, AYRICA
   yazılanları bellekte tutar: yedek alma/geri yükleme gibi "yaz sonra oku"
   akışları ancak gerçekten saklayan bir sahte ile sınanabilir. */
function firebaseYap(gunluk) {
  const alanSil = { _tur: 'FieldValue.delete' };
  // koleksiyon adı -> (belge id -> veri)
  const depo = new Map();
  const kolAl = ad => { if (!depo.has(ad)) depo.set(ad, new Map()); return depo.get(ad); };
  gunluk.firestoreDepo = depo;

  const anlik = (ad, id) => ({
    id,
    get exists() { return kolAl(ad).has(id); },
    data: () => kolAl(ad).get(id),
  });
  const belgeRef = (koleksiyon, id) => ({
    _koleksiyon: koleksiyon,
    _id: id,
    get: () => Promise.resolve(anlik(koleksiyon, id)),
  });
  const sorguSonucu = (ad, sartlar) => {
    const satirlar = [...kolAl(ad).entries()]
      .filter(([, v]) => sartlar.every(([alan, op, deger]) => {
        const x = v ? v[alan] : undefined;
        if (op === '==') return x === deger;
        if (op === '<') return x < deger;
        if (op === '>') return x > deger;
        return true;
      }))
      .map(([id, v]) => ({ id, data: () => v, exists: true }));
    return { docs: satirlar, empty: satirlar.length === 0, size: satirlar.length, forEach: f => satirlar.forEach(f) };
  };
  const koleksiyonRef = (ad, sartlar) => {
    const s = sartlar || [];
    return {
      _ad: ad,
      doc: id => belgeRef(ad, id),
      onSnapshot: (basarili) => { gunluk.dinleyiciler.push(ad); void basarili; return () => {}; },
      get: () => Promise.resolve(sorguSonucu(ad, s)),
      where: (alan, op, deger) => koleksiyonRef(ad, s.concat([[alan, op, deger]])),
      orderBy() { return this; }, limit() { return this; },
    };
  };
  const firestore = () => ({
    collection: ad => koleksiyonRef(ad),
    enablePersistence: () => Promise.resolve(),
    batch: () => {
      const islemler = [];
      return {
        set: (ref, veri, sec) => { islemler.push({ tur: 'set', ref, veri, sec }); },
        delete: ref => { islemler.push({ tur: 'delete', ref }); },
        commit: () => {
          gunluk.batchler.push(islemler);
          islemler.forEach(op => {
            const kol = kolAl(op.ref._koleksiyon);
            if (op.tur === 'delete') { kol.delete(op.ref._id); return; }
            const mevcut = (op.sec && op.sec.merge) ? Object.assign({}, kol.get(op.ref._id)) : {};
            Object.entries(op.veri).forEach(([k, v]) => {
              if (v && v._tur === 'FieldValue.delete') delete mevcut[k];
              else mevcut[k] = v;
            });
            kol.set(op.ref._id, mevcut);
          });
          return Promise.resolve();
        },
      };
    },
  });
  firestore.FieldValue = { delete: () => alanSil, serverTimestamp: () => ({ _tur: 'serverTimestamp' }) };
  return {
    initializeApp() {},
    auth: Object.assign(() => ({
      currentUser: gunluk.kullanici,
      setPersistence: () => Promise.resolve(),
      signInWithEmailAndPassword: () => Promise.resolve(),
      signOut: () => Promise.resolve(),
      onAuthStateChanged(cb) { gunluk.authGeriCagri = cb; },
    }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    firestore,
  };
}

/* ---- Ortamı kur ve uygulama betiğini çalıştır ---- */
function kur(secenekler) {
  const sec = Object.assign({ localStorage: {}, kullanici: { email: 'test@saha.app' } }, secenekler || {});
  const html = fs.readFileSync(HTML_YOLU, 'utf8');
  const bloklar = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (bloklar.length < 2) throw new Error('HTML içinde beklenen 2 inline <script> bloğu bulunamadı');

  const gunluk = { batchler: [], dinleyiciler: [], authGeriCagri: null, kullanici: sec.kullanici, bildirimler: [], uyarilar: [], onaylar: [], istenenKaynaklar: [] };
  const belge = belgeYap();
  const depo = depoYap(sec.localStorage);

  /* Tembel yüklenen kütüphaneler <head>'e <script>/<link> eklenerek alınıyor.
     Testte gerçek ağ yok; eleman eklendiğinde tarayıcının yapacağı gibi onload
     ya da onerror tetiklenmezse yükleme sözü hiç sonuçlanmaz ve test kilitlenir.
     Varsayılan davranış "ağ yok" (onerror); kutuphaneYuklenebilir:true verilirse
     başarılı yükleme taklit edilir. */
  const araliHead = belge.head.appendChild.bind(belge.head);
  belge.head.appendChild = function (el) {
    araliHead(el);
    const kaynak = el && (el.src || el.href);
    if (kaynak) {
      gunluk.istenenKaynaklar.push(kaynak);
      setImmediate(() => {
        if (sec.kutuphaneYuklenebilir) { if (el.onload) el.onload(); }
        else if (el.onerror) el.onerror(new Error('ağ yok (test)'));
      });
    }
    return el;
  };

  const zamanlayicilar = new Set();
  const pencere = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    addEventListener() {}, removeEventListener() {},
    location: { href: 'https://test.local/', reload() {} },
    navigator: {
      onLine: true,
      serviceWorker: { register: () => Promise.resolve({ update: () => Promise.resolve() }), addEventListener() {}, getRegistration: () => Promise.resolve(null), ready: Promise.resolve({ showNotification() {} }) },
      geolocation: { getCurrentPosition() {}, watchPosition() {} },
      clipboard: { writeText: () => Promise.resolve() },
      userAgent: 'node-test',
    },
    localStorage: depo,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    fetch: () => Promise.reject(new Error('ağ testte kapalı')),
    firebase: firebaseYap(gunluk),
    /* Uygulama bunları çağırıyor; testte ekrana bir şey çıkmasın ama ÇAĞRILDIĞI
       kaydedilsin — "bu durumda kullanıcı uyarıldı mı" testleri buna bakıyor. */
    alert: m => { gunluk.uyarilar.push(String(m)); },
    confirm: m => { gunluk.onaylar.push(String(m)); return gunluk.onayCevabi !== false; },
    prompt: () => null,
    Notification: Object.assign(function () { gunluk.bildirimler.push([...arguments]); }, {
      permission: sec.bildirimIzni || 'default',
      requestPermission: () => Promise.resolve(sec.bildirimIzni || 'default'),
    }),
    setTimeout: (fn, ms, ...a) => { const t = setTimeout(fn, ms, ...a); zamanlayicilar.add(t); return t; },
    clearTimeout: t => { clearTimeout(t); zamanlayicilar.delete(t); },
    setInterval: (fn, ms, ...a) => { const t = setInterval(fn, ms, ...a); zamanlayicilar.add(t); return t; },
    clearInterval: t => { clearInterval(t); zamanlayicilar.delete(t); },
    console,
    Intl, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, WeakMap, WeakSet,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal,
    Blob: class { constructor(p, o) { this.parts = p; this.options = o; } },
    File: class {}, FileReader: class { readAsText() {} },
    Intl_: null,
  };
  pencere.window = pencere;
  pencere.self = pencere;
  pencere.globalThis = pencere;
  pencere.document = belge;
  pencere.navigator.serviceWorker.controller = null;
  belge.defaultView = pencere;

  /* function bildirimleri global nesneye düşer ve testten doğrudan çağrılabilir,
     ama `const`/`let` ile tanımlananlar (state, APP_SURUM, sabitler...) betiğin
     sözcüksel kapsamında kalır ve dışarıdan görünmez. Betiğin sonuna eklenen bu
     ek, ihtiyaç duyulan bağları CANLI (getter/setter) olarak dışarı açar —
     kopya değil, gerçek değişkenin kendisi. */
  const disaAktarmaEki = `
;globalThis.__test = Object.defineProperties({}, {
  state:               { get: () => state, set: v => { state = v; }, enumerable: true },
  lastSyncedSnapshot:  { get: () => lastSyncedSnapshot, set: v => { lastSyncedSnapshot = v; }, enumerable: true },
  currentLang:         { get: () => currentLang, set: v => { currentLang = v; }, enumerable: true },
  APP_SURUM:           { get: () => APP_SURUM, enumerable: true },
  STORAGE_KEY:         { get: () => STORAGE_KEY, enumerable: true },
  AYARLAR:             { get: () => AYARLAR, enumerable: true },
  I18N_EN:             { get: () => I18N_EN, enumerable: true },
  SYNC_KOLEKSIYONLARI: { get: () => SYNC_KOLEKSIYONLARI, enumerable: true },
  YEDEK_SAKLAMA_GUN:   { get: () => YEDEK_SAKLAMA_GUN, enumerable: true },
  YEDEK_PARCA_BOYUT:   { get: () => YEDEK_PARCA_BOYUT, enumerable: true },
  YEDEK_KOLEKSIYON:    { get: () => YEDEK_KOLEKSIYON, enumerable: true },
  SEZON_TUMU:          { get: () => SEZON_TUMU, enumerable: true },
  UZUN_BASMA_MS:       { get: () => UZUN_BASMA_MS, enumerable: true },
  VURGU_SURE_MS:       { get: () => VURGU_SURE_MS, enumerable: true },
  VURGU_EN_COK:        { get: () => VURGU_EN_COK, enumerable: true },
  seciliSezon:         { get: () => seciliSezon, set: v => { seciliSezon = v; }, enumerable: true },
  ARACLAR:             { get: () => ARACLAR, enumerable: true },
  DIZIM_ALANI_TOHUM:   { get: () => DIZIM_ALANI_TOHUM, enumerable: true },
  sahaGenelSekmeAktif: { get: () => sahaGenelSekmeAktif, set: v => { sahaGenelSekmeAktif = v; }, enumerable: true },
  planSeciliTarih:     { get: () => planSeciliTarih, set: v => { planSeciliTarih = v; }, enumerable: true },
  planKip:             { get: () => planKip, set: v => { planKip = v; }, enumerable: true },
  planAcikAlanId:      { get: () => planAcikAlanId, set: v => { planAcikAlanId = v; }, enumerable: true },
  planGirisTarlaIds:   { get: () => planGirisTarlaIds, set: v => { planGirisTarlaIds = v; }, enumerable: true },
  planGirisAracId:     { get: () => planGirisAracId, set: v => { planGirisAracId = v; }, enumerable: true },
  planSeraSecim:       { get: () => planSeraSecim, set: v => { planSeraSecim = v; }, enumerable: true },
  planKirimBaglami:    { get: () => planKirimBaglami, set: v => { planKirimBaglami = v; }, enumerable: true },
  kirimAkisTarlaId:    { get: () => kirimAkisTarlaId, set: v => { kirimAkisTarlaId = v; }, enumerable: true },
  kirimAkisEkTarlaIds: { get: () => kirimAkisEkTarlaIds, set: v => { kirimAkisEkTarlaIds = v; }, enumerable: true },
  kirimAkisSeraSecimleri: { get: () => kirimAkisSeraSecimleri, set: v => { kirimAkisSeraSecimleri = v; }, enumerable: true },
});`;

  const baglam = vm.createContext(pencere);
  bloklar.forEach((kod, i) => {
    const sonBlokMu = i === bloklar.length - 1;
    try {
      vm.runInContext(kod + (sonBlokMu ? disaAktarmaEki : ''), baglam, { filename: `scv-saha-v1.html#script${i}` });
    } catch (e) {
      throw new Error(`inline script ${i} çalıştırılamadı: ${e.message}\n${e.stack}`);
    }
  });

  // state'e ve sabitlere app.state / app.APP_SURUM diye ulaşılabilsin
  Object.keys(pencere.__test).forEach(ad => {
    const tanim = Object.getOwnPropertyDescriptor(pencere.__test, ad);
    if (!(ad in pencere)) Object.defineProperty(pencere, ad, tanim);
  });

  return Object.assign(pencere, {
    _gunluk: gunluk,
    _belge: belge,
    _depo: depo,
    /* Giriş yapılmış duruma geç: uygulama Firestore dinleyicilerini ancak
       onAuthStateChanged kullanıcıyla tetiklendiğinde kuruyor. */
    _girisYapildi() { if (gunluk.authGeriCagri) gunluk.authGeriCagri(gunluk.kullanici); },
    _cikisYapildi() { if (gunluk.authGeriCagri) gunluk.authGeriCagri(null); },
    _temizle() { zamanlayicilar.forEach(t => { clearTimeout(t); clearInterval(t); }); zamanlayicilar.clear(); },
  });
}

module.exports = { kur, dugumYap, belgeYap, depoYap };

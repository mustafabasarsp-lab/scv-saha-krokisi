# Saha Planlama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Bu depoda istisna:** `CLAUDE.md` alt ajan kullanımını yasaklıyor (her ajan 9.000 satırlık `scv-saha-v1.html`'i yeniden okuyor). Plan ana oturumda, `superpowers:executing-plans` ile yürütülmeli.

**Goal:** Tütünün tarladan şoför/araçla dizim alanına, oradan seralara gidişini gün gün planlayan; seçim tabanlı, şematik ve mevcut kırım/işaret sistemine bağlanan bir "Saha Planlama" ekranı eklemek.

**Architecture:** İki yeni Firestore koleksiyonu (`dizimAlanlari` kalıcı yerler, `sahaPlanlari` günde bir belge). Araçlar kodda sabit liste. Tüm plan mantığı saf fonksiyonlar olarak yazılır ve `tests/run.js` ile sınanır; render katmanı bu fonksiyonların üstüne biner. Çalışma işareti plana **yazılmaz**, plandan türetilir — mevcut "tarih tutan işaret" tasarımı korunur.

**Tech Stack:** Tek dosya `scv-saha-v1.html` (inline CSS + JS, çerçeve yok), Firebase Firestore compat API, `node tests/run.js` (bağımlılıksız kendi harness'ı), PWA service worker `sw.js`.

## Global Constraints

- **Şartname:** `docs/superpowers/specs/2026-08-04-saha-planlama-design.md`. Çelişki olursa şartname esastır.
- **Tek dosya:** Tüm uygulama kodu `scv-saha-v1.html` içindeki inline `<script>` bloğunda. Yeni dosya oluşturulmaz.
- **Dil:** Tüm tanımlayıcılar ve yorumlar Türkçe, mevcut kodun üslubuyla (`renderSeralar`, `tarlaBul`, `seraKalanYer`). Kullanıcıya görünen her yeni metin `i18n()` üzerinden geçer ve `I18N_EN` sözlüğüne İngilizce karşılığı eklenir.
- **Sürümleme yasak:** `APP_SURUM` ve `sw.js` içindeki `CACHE_NAME` **elle değiştirilmez**; pre-commit kancası otomatik artırır.
- **Kural eşleşmesi zorunlu:** `SYNC_KOLEKSIYONLARI` içine eklenen her koleksiyon `firestore.rules` içindeki `collection in [...]` listelerinde de bulunmalı; yoksa pre-commit kancası commit'i durdurur. Kural değişikliği **Firebase Console'dan elle publish** edilmelidir (Task 1 sonunda hatırlatılır).
- **Test komutu:** `node tests/run.js`. Her task'ın son adımı bu komutun tamamen geçmesidir.
- **Belirteç kuralı:** Yeni CSS renk/ölçü değeri yazılmaz; mevcut `var(--...)` belirteçleri kullanılır (`--green-100`, `--muted`, `--r-pill`, `--fs-md`, `--sp-2` vb.). Koyu tema ayrı bir blok gerektirmez, belirteçler zaten iki temayı da karşılar.
- **Plan tarihi sezondan bağımsızdır:** Plan ekranının tarih seçicisi üstteki sezon seçicisinden etkilenmez; `sahaPlanlari`, `SEZON_OLAY_KOLEKSIYONLARI` listesine **eklenmez**.
- **Dizim alanı adları:** `D.A1 D.A2 D.A3 D.A4 D.B1 D.B2 D.B3 D.B4` — `D.` öneki sera adlarıyla çakışmayı önler.
- **Bölme sınırı:** Bir dizim alanı en az 1, en çok 4 bölme.

---

### Task 1: Veri katmanı — koleksiyonlar, araç sabiti, tohumlama

**Files:**
- Modify: `scv-saha-v1.html:2530` (`bosState`)
- Modify: `scv-saha-v1.html:2693` (`SYNC_KOLEKSIYONLARI`)
- Modify: `scv-saha-v1.html` — `seraKalanYer` (4961) öncesine yeni "SAHA PLANLAMA — VERİ" bölümü
- Modify: `firestore.rules:20-24` ve `:33-37` (izinli koleksiyon listeleri)
- Modify: `tests/harness.js:344` (`disaAktarmaEki` — `ARACLAR`, `DIZIM_ALANI_TOHUM` dışa açılır)
- Test: `tests/run.js` (sona yeni "Saha Planlama — veri" bölümü)

**Interfaces:**
- Produces: `ARACLAR` (dizi: `{id, ad, tip, renk}`), `DIZIM_ALANI_TOHUM` (dizi: string),
  `aracBul(id) -> {id,ad,tip,renk}|undefined`,
  `dizimAlaniBul(id) -> obje|undefined`,
  `dizimAlanlariSirali() -> obje[]`,
  `dizimAlanlariTohumla() -> number` (eklenen alan sayısı),
  `planBul(tarih) -> plan|undefined`,
  `planGetir(tarih) -> plan` (yoksa yaratır ve `state.sahaPlanlari`'na ekler),
  `planAlanGetir(plan, alanId) -> alanGirdisi` (yoksa yaratır, tek bölmeyle),
  `bosBolme() -> {id, girisler:[], seraIds:[], kirimId:null, not:''}`,
  `planBosMu(plan) -> boolean`,
  `planCopTopla(tarih) -> boolean` (boş kalan plan belgesini state'ten düşürür)

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — veri katmanı
   Plan belgeleri TEMBEL oluşur: boş günler için çöp belge birikmemeli.
   --------------------------------------------------------------- */
bolum('Saha Planlama — veri');
{
  const app = kur();
  esit(app.state.dizimAlanlari, [], 'yeni kurulumda dizim alanı listesi boş');
  esit(app.state.sahaPlanlari, [], 'yeni kurulumda plan listesi boş');
  dogru(app.SYNC_KOLEKSIYONLARI.includes('dizimAlanlari'), 'dizimAlanlari senkron listesinde');
  dogru(app.SYNC_KOLEKSIYONLARI.includes('sahaPlanlari'), 'sahaPlanlari senkron listesinde');
  app._temizle();
}
{
  const app = kur();
  esit(app.dizimAlanlariTohumla(), 8, 'ilk tohumlama 8 alan ekler');
  esit(app.dizimAlanlariSirali().map(a => a.ad),
    ['D.A1','D.A2','D.A3','D.A4','D.B1','D.B2','D.B3','D.B4'], 'alan adları ve sırası');
  esit(app.dizimAlanlariTohumla(), 0, 'ikinci tohumlama hiçbir şey eklemez');
  app._temizle();
}
{
  const app = kur();
  esit(app.ARACLAR.length, 4, '2 traktör + 2 transit');
  esit(app.ARACLAR.map(a => a.id), ['traktor1','traktor2','transit1','transit2'], 'araç kimlikleri');
  esit(app.aracBul('transit2').ad, 'Transit 2', 'araç ada göre bulunur');
  esit(app.aracBul('yok'), undefined, 'olmayan araç undefined');
  dogru(app.ARACLAR.every(a => /^var\(--[a-z0-9-]+\)$/.test(a.renk)), 'araç renkleri belirteç kullanır');
  app._temizle();
}
{
  // Tembel oluşma: okumak belge yaratmaz, yazmak yaratır
  const app = kur();
  esit(app.planBul('2026-08-05'), undefined, 'olmayan günün planı okunurken yaratılmaz');
  esit(app.state.sahaPlanlari.length, 0, 'okuma sonrası liste hâlâ boş');

  const plan = app.planGetir('2026-08-05');
  esit(plan.tarih, '2026-08-05', 'planGetir tarihi yazar');
  esit(plan.id, '2026-08-05', 'belge id doğrudan tarih');
  esit(app.state.sahaPlanlari.length, 1, 'planGetir belgeyi state e ekler');
  esit(app.planGetir('2026-08-05'), plan, 'ikinci çağrı aynı belgeyi döndürür');

  dogru(app.planBosMu(plan), 'alanı olmayan plan boştur');
  app._temizle();
}
{
  const app = kur();
  app.dizimAlanlariTohumla();
  const alanId = app.dizimAlanlariSirali()[0].id;
  const plan = app.planGetir('2026-08-05');
  const alan = app.planAlanGetir(plan, alanId);
  esit(alan.alanId, alanId, 'alan girdisi alanId taşır');
  esit(alan.bolmeler.length, 1, 'alan tek bölmeyle açılır');
  esit(alan.bolmeler[0].girisler, [], 'yeni bölmenin girişi yok');
  esit(alan.bolmeler[0].seraIds, [], 'yeni bölmenin serası yok');
  esit(alan.bolmeler[0].kirimId, null, 'yeni bölme kırım kaydına bağlı değil');
  esit(app.planAlanGetir(plan, alanId), alan, 'ikinci çağrı aynı alanı döndürür');

  dogru(app.planBosMu(plan), 'boş bölmeden ibaret plan hâlâ boş sayılır');
  dogru(app.planCopTopla('2026-08-05'), 'boş plan çöp toplanır');
  esit(app.state.sahaPlanlari.length, 0, 'çöp toplama sonrası belge kalmaz');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.dizimAlanlariTohumla is not a function` benzeri hatalar; `app.state.dizimAlanlari` `undefined`.

- [ ] **Step 3: `bosState` ve `SYNC_KOLEKSIYONLARI` listelerine ekle**

`scv-saha-v1.html:2530` — `bosState` dönüşüne iki alan ekle (satır uzun; mevcut biçimi koru):

```js
function bosState(){ return { tarlalar: [], seralar: [], kirimlar: [], haritaPinleri: [], tesisPinleri: [], depoKutulari: [], sulamaKayitlari: [], iklimKayitlari: [], dayibasilar: [], yevmiyeKayitlari: [], odemeKayitlari: [], odemeAyarlari: [], dizimAlanlari: [], sahaPlanlari: [] }; }
```

`scv-saha-v1.html:2693`:

```js
const SYNC_KOLEKSIYONLARI = ['tarlalar','seralar','kirimlar','haritaPinleri','tesisPinleri','depoKutulari','sulamaKayitlari','iklimKayitlari','dayibasilar','yevmiyeKayitlari','odemeKayitlari','odemeAyarlari','dizimAlanlari','sahaPlanlari'];
```

- [ ] **Step 4: `firestore.rules` izin listelerini güncelle**

İki blokta da (`allow read, delete` ve `allow create, update`) `odemeAyarlari` satırının ardına yeni bir `||` satırı ekle. **Satırları birleştirme** — dosyanın başındaki açıklama, uzun satırların Console'da sarıp bozulduğunu anlatıyor:

```
         || collection in ['yevmiyeKayitlari', 'odemeKayitlari', 'odemeAyarlari']
         || collection in ['dizimAlanlari', 'sahaPlanlari']);
```

(Önceki satırın sonundaki `);` kaldırılıp yeni satırın sonuna taşınır.)

- [ ] **Step 5: Veri bölümünü yaz**

`scv-saha-v1.html` içinde `function seraKalanYer(` (≈4961) satırının **hemen öncesine** ekle:

```js
/* =========================================================
   SAHA PLANLAMA — VERİ
   Tütünün tarladan seraya yolculuğu: tarla → (araç + şoför) → dizim alanı
   bölmesi → seralar. Plan GÜNLÜKTÜR, belge id'si doğrudan tarihtir.
   ========================================================= */

/* Sahada 2 traktör + 2 transit var; şoförleri her gün değişiyor, bu yüzden
   kalıcı olan ARAÇ, şoför adı ise planda serbest metin. Dört kalemlik bir liste
   için ayrı koleksiyon + güvenlik kuralı + yönetim ekranı israf olurdu; filo
   değişirse buraya bir satır eklenir. Renkler belirteç — koyu temada da okunur. */
const ARACLAR = [
  { id:'traktor1', ad:'Traktör 1', tip:'traktor', renk:'var(--green-700)' },
  { id:'traktor2', ad:'Traktör 2', tip:'traktor', renk:'var(--green-500)' },
  { id:'transit1', ad:'Transit 1', tip:'transit', renk:'var(--tobacco-deep)' },
  { id:'transit2', ad:'Transit 2', tip:'transit', renk:'var(--amber)' }
];
function aracBul(id){ return ARACLAR.find(a=>a.id===id); }

/* Sahadaki 8 dizim alanı. 'D.' öneki sera adlarıyla (A1…A41, B1…B40) çakışmayı
   önler — arama, rapor, yedek ve sözlü iletişimde "A1" hangi A1 belirsizliği
   kalmasın diye. Şemada kutu içinde büyük "A1", altında küçük "DİZİM" yazar. */
const DIZIM_ALANI_TOHUM = ['D.A1','D.A2','D.A3','D.A4','D.B1','D.B2','D.B3','D.B4'];
function dizimAlaniBul(id){ return state.dizimAlanlari.find(a=>a.id===id); }
function dizimAlanlariSirali(){
  return [...state.dizimAlanlari].sort((a,b)=>(a.sira||0)-(b.sira||0) || (a.ad||'').localeCompare(b.ad||'','tr',{numeric:true}));
}
/* Liste boşsa 8 alanı kurar. Var olan adlara dokunmaz: kullanıcı bir alanı
   silmişse tohumlama onu geri getirmez, yalnızca hiç yoksa doldurur. */
function dizimAlanlariTohumla(){
  if(state.dizimAlanlari.length) return 0;
  DIZIM_ALANI_TOHUM.forEach((ad,i)=>{
    state.dizimAlanlari.push({
      id: uid(), ad,
      bolge: ad.startsWith('D.A') ? 'kalemli' : 'tekeliler',
      sira: i+1, olusturma: Date.now(), ...sonIslemDamgasi()
    });
  });
  return DIZIM_ALANI_TOHUM.length;
}

function bosBolme(){ return { id: uid(), girisler: [], seraIds: [], kirimId: null, not: '' }; }
function planBul(tarih){ return state.sahaPlanlari.find(p=>p.tarih===tarih); }
/* Yazma yolundaki tek giriş noktası. Okuma yapan hiçbir yer bunu ÇAĞIRMAMALI —
   yoksa sadece bakılan her gün için çöp belge yazılır. Okumalar planBul kullanır. */
function planGetir(tarih){
  let p = planBul(tarih);
  if(!p){
    p = { id: tarih, tarih, alanlar: [], olusturma: Date.now(), ...sonIslemDamgasi() };
    state.sahaPlanlari.push(p);
  }
  return p;
}
function planAlanGetir(plan, alanId){
  let a = plan.alanlar.find(x=>x.alanId===alanId);
  if(!a){ a = { alanId, bolmeler: [bosBolme()] }; plan.alanlar.push(a); }
  return a;
}
/* Hiç giriş ve hiç sera yoksa plan "boş"tur — kullanıcı bir alana dokunup
   vazgeçmiş olabilir, o hâl kaydedilmeye değmez. */
function planBosMu(plan){
  return !plan || !plan.alanlar.some(a=>a.bolmeler.some(b=>b.girisler.length || b.seraIds.length));
}
function planCopTopla(tarih){
  const p = planBul(tarih);
  if(!p || !planBosMu(p)) return false;
  state.sahaPlanlari = state.sahaPlanlari.filter(x=>x!==p);
  return true;
}
```

- [ ] **Step 6: Uygulama açılışında tohumlamayı çağır**

`renderAll` (3373) içinde `renderSezonSecici();` satırının **öncesine** ekle:

```js
  dizimAlanlariTohumla(); // liste boşsa 8 dizim alanını kurar; doluysa hiçbir şey yapmaz
```

- [ ] **Step 7: Harness'a yeni sabitleri aç**

`tests/harness.js` içinde `disaAktarmaEki` şablonunda `SEZON_TUMU` satırının ardına ekle:

```js
  ARACLAR:             { get: () => ARACLAR, enumerable: true },
  DIZIM_ALANI_TOHUM:   { get: () => DIZIM_ALANI_TOHUM, enumerable: true },
```

- [ ] **Step 8: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS — "Saha Planlama — veri" bölümündeki tüm iddialar geçer, eski testler bozulmaz.

- [ ] **Step 9: Commit**

```bash
git add scv-saha-v1.html firestore.rules tests/harness.js tests/run.js
git commit -m "saha planlama veri katmanı: dizim alanları ve günlük plan koleksiyonları

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Kuralları publish etmeyi kullanıcıya hatırlat**

Commit sonrası kullanıcıya söyle: `firestore.rules` değişti, **Firebase Console > Firestore > Rules > Publish** yapılmadan yeni koleksiyonlar senkronlanmaz (yazma sessizce reddedilir). Bu adım plan içinde otomatikleştirilemez.

---

### Task 2: Plan mutasyonları — bölme, giriş, sera, takas

**Files:**
- Modify: `scv-saha-v1.html` — Task 1'de açılan "SAHA PLANLAMA — VERİ" bölümünün sonuna
- Test: `tests/run.js` (yeni "Saha Planlama — mutasyonlar" bölümü)

**Interfaces:**
- Consumes: `planGetir`, `planAlanGetir`, `bosBolme`, `planCopTopla` (Task 1)
- Produces:
  `PLAN_BOLME_SINIRI = 4`,
  `planBolmeEkle(tarih, alanId) -> boolean` (sınıra ulaşıldıysa false),
  `planBolmeBirlestir(tarih, alanId) -> boolean` (tek bölme kaldıysa false),
  `planBolmeBul(plan, alanId, bolmeId) -> bolme|undefined`,
  `planGirisEkle(tarih, alanId, bolmeId, tarlaId, aracId, sofor) -> boolean`,
  `planGirisKaldir(tarih, alanId, bolmeId, tarlaId) -> boolean`,
  `planSeraEkle(tarih, alanId, bolmeId, seraId) -> boolean`,
  `planSeraKaldir(tarih, alanId, bolmeId, seraId) -> boolean`,
  `planTarlaTakas(tarih, tarlaIdA, tarlaIdB) -> boolean`,
  `planAlanTakas(tarih, alanIdA, alanIdB) -> boolean`,
  `planSeraTakas(tarih, seraIdA, seraIdB) -> boolean`

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — mutasyonlar
   Sahada bir dizim alanı kartonla bölünüp farklı kodlar ayrı ayrı indirilebiliyor;
   bölme mekaniği bunun karşılığı. Bir sera aynı anda tek bölmeye ait olabilir.
   --------------------------------------------------------------- */
bolum('Saha Planlama — mutasyonlar');

/* Ortak kurulum: 8 dizim alanı, 3 tarla, 4 sera.
   T bilerek YARIN: çalışma işareti bugünün planından türetildiği için, sabit
   bir tarih kullanmak testin o gün çalıştırıldığında yanlış geçmesine yol açardı. */
function planOrtami(){
  const app = kur();
  app.dizimAlanlariTohumla();
  ['K11','K21','K13'].forEach((ad,i)=>app.state.tarlalar.push({
    id:'t'+i, ad, dekar:10, cesit: ad==='K13' ? 'PVH 2310' : 'BSB 6195', bolge:'kalemli'
  }));
  ['D1','D2','D4','C2'].forEach((ad,i)=>app.state.seralar.push({
    id:'s'+i, ad, kapasite:1000, bolge:'kalemli', donemler:[]
  }));
  const alanlar = app.dizimAlanlariSirali();
  const yarin = new Date(Date.now() + 86400000).toISOString().slice(0,10);
  return { app, T:yarin, a1:alanlar[0].id, a2:alanlar[1].id };
}

{ // Bölme ekleme 4'te durur
  const { app, T, a1 } = planOrtami();
  esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 1, 'alan tek bölmeyle başlar');
  dogru(app.planBolmeEkle(T, a1), '2. bölme eklenir');
  dogru(app.planBolmeEkle(T, a1), '3. bölme eklenir');
  dogru(app.planBolmeEkle(T, a1), '4. bölme eklenir');
  yanlis(app.planBolmeEkle(T, a1), '5. bölme reddedilir');
  esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 4, 'bölme sayısı 4 te kalır');
  app._temizle();
}
{ // Birleştirme içerikleri üst bölmeye taşır, yinelenen sera tekrar yazılmaz
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const alan = app.planAlanGetir(plan, a1);
  const b1 = alan.bolmeler[0].id;
  app.planBolmeEkle(T, a1);
  const b2 = alan.bolmeler[1].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planSeraEkle(T, a1, b1, 's0');
  app.planGirisEkle(T, a1, b2, 't2', 'transit1', 'Veli');
  app.planSeraEkle(T, a1, b2, 's1');

  dogru(app.planBolmeBirlestir(T, a1), 'son bölme birleştirilir');
  esit(alan.bolmeler.length, 1, 'birleştirme sonrası tek bölme');
  esit(alan.bolmeler[0].girisler.map(g=>g.tarlaId), ['t0','t2'], 'girişler üst bölmeye taşındı');
  esit(alan.bolmeler[0].seraIds, ['s0','s1'], 'seralar üst bölmeye taşındı');
  yanlis(app.planBolmeBirlestir(T, a1), 'tek bölme daha fazla birleştirilemez');
  app._temizle();
}
{ // Sera tekil sahiplik: ikinci bölmeye eklenince öncekinden düşer
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
  app.planSeraEkle(T, a1, b1, 's0');
  app.planSeraEkle(T, a1, b1, 's1');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].seraIds, ['s0','s1'], 'iki sera eklendi');

  app.planSeraEkle(T, a2, b2, 's0');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].seraIds, ['s1'], 's0 önceki bölmeden düştü');
  esit(app.planAlanGetir(plan, a2).bolmeler[0].seraIds, ['s0'], 's0 yeni bölmeye geçti');

  yanlis(app.planSeraEkle(T, a2, b2, 's0'), 'aynı seranın tekrarı yok sayılır');
  esit(app.planAlanGetir(plan, a2).bolmeler[0].seraIds, ['s0'], 'liste yinelenmedi');
  app._temizle();
}
{ // Aynı tarla aynı bölmede yinelenmez ama farklı bölmelerde olabilir
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
  dogru(app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet'), 'giriş eklenir');
  yanlis(app.planGirisEkle(T, a1, b1, 't0', 'transit1', 'Veli'), 'aynı bölmeye aynı tarla iki kez girmez');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].girisler.length, 1, 'giriş yinelenmedi');
  dogru(app.planGirisEkle(T, a2, b2, 't0', 'transit1', 'Veli'), 'aynı tarla başka bölmeye girebilir');

  dogru(app.planGirisKaldir(T, a1, b1, 't0'), 'giriş kaldırılır');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].girisler, [], 'giriş listesi boşaldı');
  yanlis(app.planGirisKaldir(T, a1, b1, 't0'), 'olmayan giriş kaldırılamaz');
  app._temizle();
}
{ // Takas — iki tarla
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a2, b2, 't2', 'transit1', 'Veli');

  dogru(app.planTarlaTakas(T, 't0', 't2'), 'iki tarla takas edilir');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].girisler[0].tarlaId, 't2', 'a1 bölmesine t2 geçti');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].girisler[0].sofor, 'Ahmet', 'araç ve şoför yerinde kalır');
  esit(app.planAlanGetir(plan, a2).bolmeler[0].girisler[0].tarlaId, 't0', 'a2 bölmesine t0 geçti');
  app._temizle();
}
{ // Takas — iki sera
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
  app.planSeraEkle(T, a1, b1, 's0');
  app.planSeraEkle(T, a2, b2, 's1');
  dogru(app.planSeraTakas(T, 's0', 's1'), 'iki sera takas edilir');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].seraIds, ['s1'], 'a1 bölmesine s1 geçti');
  esit(app.planAlanGetir(plan, a2).bolmeler[0].seraIds, ['s0'], 'a2 bölmesine s0 geçti');
  app._temizle();
}
{ // Takas — iki dizim alanı: bütün bölme içerikleri yer değiştirir
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planSeraEkle(T, a1, b1, 's0');
  app.planBolmeEkle(T, a1);
  app.planAlanGetir(plan, a2); // a2 boş ama var

  dogru(app.planAlanTakas(T, a1, a2), 'iki alan takas edilir');
  esit(app.planAlanGetir(plan, a2).bolmeler.length, 2, 'bölme sayısı a2 ye geçti');
  esit(app.planAlanGetir(plan, a2).bolmeler[0].girisler[0].tarlaId, 't0', 'giriş a2 ye geçti');
  esit(app.planAlanGetir(plan, a2).bolmeler[0].seraIds, ['s0'], 'sera a2 ye geçti');
  esit(app.planAlanGetir(plan, a1).bolmeler.length, 1, 'a1 boş alanın içeriğini aldı');
  esit(app.planAlanGetir(plan, a1).bolmeler[0].girisler, [], 'a1 girişsiz kaldı');
  app._temizle();
}
{ // Takas kendiyle yapılamaz
  const { app, T, a1 } = planOrtami();
  yanlis(app.planTarlaTakas(T, 't0', 't0'), 'tarla kendiyle takas edilmez');
  yanlis(app.planSeraTakas(T, 's0', 's0'), 'sera kendiyle takas edilmez');
  yanlis(app.planAlanTakas(T, a1, a1), 'alan kendiyle takas edilmez');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.planBolmeEkle is not a function`.

- [ ] **Step 3: Mutasyonları yaz**

Task 1'in "SAHA PLANLAMA — VERİ" bölümünün sonuna (yani `planCopTopla` ardına) ekle:

```js
/* ---- Plan mutasyonları ----
   Hepsi tarih + alanId + bolmeId üçlüsüyle çalışır ve değişiklik olduysa true
   döner; çağıran taraf dönüşe bakıp gereksiz yeniden çizimden kaçınabilir.
   Değişiklik yapan her fonksiyon plan belgesine sonIslemDamgasi yazar —
   senkron katmanı bu damgayla neyin gönderileceğine karar veriyor. */
const PLAN_BOLME_SINIRI = 4;

function planDamgala(plan){ Object.assign(plan, sonIslemDamgasi()); }
function planBolmeBul(plan, alanId, bolmeId){
  const a = plan && plan.alanlar.find(x=>x.alanId===alanId);
  return a && a.bolmeler.find(b=>b.id===bolmeId);
}
function planBolmeEkle(tarih, alanId){
  const plan = planGetir(tarih);
  const alan = planAlanGetir(plan, alanId);
  if(alan.bolmeler.length >= PLAN_BOLME_SINIRI) return false;
  alan.bolmeler.push(bosBolme());
  planDamgala(plan);
  return true;
}
/* Son bölmeyi bir öncekine katar. Sahadaki karşılığı: aradaki kartonu almak —
   iki yığın tek yığın olur, hiçbir şey silinmez. */
function planBolmeBirlestir(tarih, alanId){
  const plan = planGetir(tarih);
  const alan = planAlanGetir(plan, alanId);
  if(alan.bolmeler.length < 2) return false;
  const son = alan.bolmeler.pop();
  const hedef = alan.bolmeler[alan.bolmeler.length-1];
  son.girisler.forEach(g=>{ if(!hedef.girisler.some(x=>x.tarlaId===g.tarlaId)) hedef.girisler.push(g); });
  son.seraIds.forEach(id=>{ if(!hedef.seraIds.includes(id)) hedef.seraIds.push(id); });
  planDamgala(plan);
  return true;
}
function planGirisEkle(tarih, alanId, bolmeId, tarlaId, aracId, sofor){
  const plan = planGetir(tarih);
  const bolme = planBolmeBul(plan, alanId, bolmeId);
  if(!bolme || bolme.girisler.some(g=>g.tarlaId===tarlaId)) return false;
  bolme.girisler.push({ tarlaId, aracId: aracId||'', sofor: (sofor||'').trim() });
  planDamgala(plan);
  return true;
}
function planGirisKaldir(tarih, alanId, bolmeId, tarlaId){
  const plan = planBul(tarih);
  const bolme = planBolmeBul(plan, alanId, bolmeId);
  if(!bolme) return false;
  const once = bolme.girisler.length;
  bolme.girisler = bolme.girisler.filter(g=>g.tarlaId!==tarlaId);
  if(bolme.girisler.length === once) return false;
  planDamgala(plan);
  return true;
}
/* Bir sera aynı planda YALNIZ bir bölmeye ait olabilir: aynı seraya iki ayrı
   koddan tütün gitmesi sahada hata demek. Başka bölmedeyse sessizce değil,
   taşınarak çözülür — çağıran taraf kullanıcıyı bilgilendirir. */
function planSeraEkle(tarih, alanId, bolmeId, seraId){
  const plan = planGetir(tarih);
  const hedef = planBolmeBul(plan, alanId, bolmeId);
  if(!hedef || hedef.seraIds.includes(seraId)) return false;
  plan.alanlar.forEach(a=>a.bolmeler.forEach(b=>{
    if(b!==hedef) b.seraIds = b.seraIds.filter(id=>id!==seraId);
  }));
  hedef.seraIds.push(seraId);
  planDamgala(plan);
  return true;
}
function planSeraKaldir(tarih, alanId, bolmeId, seraId){
  const plan = planBul(tarih);
  const bolme = planBolmeBul(plan, alanId, bolmeId);
  if(!bolme || !bolme.seraIds.includes(seraId)) return false;
  bolme.seraIds = bolme.seraIds.filter(id=>id!==seraId);
  planDamgala(plan);
  return true;
}
/* ---- Takas ("futbol değişikliği") ----
   Tarla ve sera takasında YER değil KİMLİK değişir: araç/şoför bulunduğu
   bacakta kalır, çünkü değişen şey "bu bacağa hangi tarla düşüyor" sorusu. */
function planTarlaTakas(tarih, tarlaIdA, tarlaIdB){
  if(!tarlaIdA || !tarlaIdB || tarlaIdA===tarlaIdB) return false;
  const plan = planBul(tarih);
  if(!plan) return false;
  let degisti = false;
  plan.alanlar.forEach(a=>a.bolmeler.forEach(b=>b.girisler.forEach(g=>{
    if(g.tarlaId===tarlaIdA){ g.tarlaId = tarlaIdB; degisti = true; }
    else if(g.tarlaId===tarlaIdB){ g.tarlaId = tarlaIdA; degisti = true; }
  })));
  if(degisti) planDamgala(plan);
  return degisti;
}
function planSeraTakas(tarih, seraIdA, seraIdB){
  if(!seraIdA || !seraIdB || seraIdA===seraIdB) return false;
  const plan = planBul(tarih);
  if(!plan) return false;
  let degisti = false;
  plan.alanlar.forEach(a=>a.bolmeler.forEach(b=>{
    b.seraIds = b.seraIds.map(id=>{
      if(id===seraIdA){ degisti = true; return seraIdB; }
      if(id===seraIdB){ degisti = true; return seraIdA; }
      return id;
    });
  }));
  if(degisti) planDamgala(plan);
  return degisti;
}
/* Alan takasında bölmelerin TAMAMI yer değiştirir — "bu işi A1 yerine A2 yapsın"
   demek, bölme yapısıyla birlikte taşınır. */
function planAlanTakas(tarih, alanIdA, alanIdB){
  if(!alanIdA || !alanIdB || alanIdA===alanIdB) return false;
  const plan = planGetir(tarih);
  const a = planAlanGetir(plan, alanIdA);
  const b = planAlanGetir(plan, alanIdB);
  const gecici = a.bolmeler;
  a.bolmeler = b.bolmeler;
  b.bolmeler = gecici;
  planDamgala(plan);
  return true;
}
```

- [ ] **Step 4: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS — "Saha Planlama — mutasyonlar" bölümündeki tüm iddialar geçer.

- [ ] **Step 5: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "plan mutasyonları: bölme, giriş, sera ve takas işlemleri

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Türetimler — çeşit, karışma uyarısı, boş alanlar

**Files:**
- Modify: `scv-saha-v1.html` — Task 2'nin sonuna
- Test: `tests/run.js` (yeni "Saha Planlama — türetimler" bölümü)

**Interfaces:**
- Consumes: `planBul`, `tarlaBul`, `dizimAlanlariSirali` (Task 1–2)
- Produces:
  `planBolmeCesitleri(bolme) -> string[]` (benzersiz, boşlar atılmış),
  `planBolmeKarisikMi(bolme) -> boolean`,
  `planBolmeEtiketi(bolme) -> string` (kutuda yazan çeşit metni),
  `planBosAlanIdleri(tarih) -> string[]`,
  `planUyarilari(tarih) -> string[]` (kullanıcıya gösterilecek hazır metinler)

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle (Task 2'deki `planOrtami` yardımcısı yeniden kullanılır):

```js
/* ---------------------------------------------------------------
   Saha Planlama — türetimler
   Bölmenin çeşidi SAKLANMAZ, tarlalardan türetilir: tek kaynak korunur,
   tarlanın çeşidi düzeltilince plan kendiliğinden doğrulanır.
   --------------------------------------------------------------- */
bolum('Saha Planlama — türetimler');
{
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  const bolme = app.planBolmeBul(plan, a1, b1);

  esit(app.planBolmeCesitleri(bolme), [], 'girişsiz bölmenin çeşidi yok');
  esit(app.planBolmeEtiketi(bolme), '—', 'girişsiz bölme tire gösterir');

  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet'); // K11 · BSB 6195
  esit(app.planBolmeCesitleri(bolme), ['BSB 6195'], 'tek çeşit');
  yanlis(app.planBolmeKarisikMi(bolme), 'tek çeşit karışık değil');
  esit(app.planBolmeEtiketi(bolme), 'BSB 6195', 'etiket çeşidi yazar');

  app.planGirisEkle(T, a1, b1, 't1', 'traktor1', 'Ahmet'); // K21 · BSB 6195
  esit(app.planBolmeCesitleri(bolme), ['BSB 6195'], 'aynı çeşit yinelenmez');
  yanlis(app.planBolmeKarisikMi(bolme), 'aynı çeşitten iki tarla karışma değil');

  app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli'); // K13 · PVH 2310
  esit(app.planBolmeCesitleri(bolme), ['BSB 6195','PVH 2310'], 'iki çeşit');
  dogru(app.planBolmeKarisikMi(bolme), 'farklı çeşit aynı bölmede karışma');
  esit(app.planBolmeEtiketi(bolme), 'BSB 6195 + PVH 2310', 'etiket iki çeşidi birleştirir');
  app._temizle();
}
{ // Farklı bölmelerde farklı çeşit normaldir — uyarı çıkmaz
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const alan = app.planAlanGetir(plan, a1);
  const b1 = alan.bolmeler[0].id;
  app.planBolmeEkle(T, a1);
  const b2 = alan.bolmeler[1].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a1, b2, 't2', 'transit1', 'Veli');

  yanlis(app.planBolmeKarisikMi(app.planBolmeBul(plan, a1, b1)), '1. bölme temiz');
  yanlis(app.planBolmeKarisikMi(app.planBolmeBul(plan, a1, b2)), '2. bölme temiz');
  esit(app.planUyarilari(T).filter(u=>u.includes('karış')).length, 0, 'ayrı bölmelerde karışma uyarısı yok');
  app._temizle();
}
{ // Karışma uyarısı alan adını ve bölme numarasını söyler
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli');
  const uyarilar = app.planUyarilari(T);
  esit(uyarilar.filter(u=>u.includes('karış')).length, 1, 'tek karışma uyarısı');
  dogru(uyarilar.some(u=>u.includes('D.A1') && u.includes('BSB 6195') && u.includes('PVH 2310')),
    'uyarı alan adını ve iki çeşidi içerir');
  app._temizle();
}
{ // Boş alanlar
  const { app, T, a1 } = planOrtami();
  esit(app.planBosAlanIdleri(T).length, 8, 'plan yokken 8 alanın hepsi boş');
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  esit(app.planBosAlanIdleri(T).length, 7, 'giriş alan bir alanı boş listesinden çıkarır');
  yanlis(app.planBosAlanIdleri(T).includes(a1), 'dolu alan boş listesinde yok');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.planBolmeCesitleri is not a function`.

- [ ] **Step 3: Türetimleri yaz**

Task 2'nin sonuna ekle:

```js
/* ---- Türetimler ----
   Bölmenin çeşidi belgeye YAZILMAZ; içindeki tarlalardan okunur. Böylece
   tarlanın çeşidi düzeltildiğinde geçmiş planlar da kendiliğinden doğrulanır
   ve iki yerde tutulan bir gerçek olmaz. */
function planBolmeCesitleri(bolme){
  const kume = [];
  (bolme ? bolme.girisler : []).forEach(g=>{
    const c = ((tarlaBul(g.tarlaId)||{}).cesit||'').trim();
    if(c && !kume.includes(c)) kume.push(c);
  });
  return kume;
}
function planBolmeKarisikMi(bolme){ return planBolmeCesitleri(bolme).length > 1; }
function planBolmeEtiketi(bolme){
  const c = planBolmeCesitleri(bolme);
  return c.length ? c.join(' + ') : '—';
}
/* Hiç giriş VE hiç sera almamış alanlar. Planlamanın asıl sorusu "hangi alan
   boş kaldı" olduğu için bu liste şemanın altında açıkça yazılır. */
function planBosAlanIdleri(tarih){
  const plan = planBul(tarih);
  return dizimAlanlariSirali().filter(al=>{
    const a = plan && plan.alanlar.find(x=>x.alanId===al.id);
    return !a || !a.bolmeler.some(b=>b.girisler.length || b.seraIds.length);
  }).map(al=>al.id);
}
/* Kullanıcıya gösterilecek hazır uyarı metinleri. Karışma ENGELLENMEZ —
   'Mix' ve 'Deneme' tarlaları var, kilitlemek sahadaki işi tıkar. */
function planUyarilari(tarih){
  const plan = planBul(tarih);
  const cikti = [];
  if(plan){
    plan.alanlar.forEach(a=>{
      const alanAd = (dizimAlaniBul(a.alanId)||{}).ad || '?';
      a.bolmeler.forEach((b,i)=>{
        if(planBolmeKarisikMi(b)){
          cikti.push(`${alanAd} ${i+1}. bölmesinde ${planBolmeCesitleri(b).join(' ve ')} karışıyor.`);
        }
      });
    });
  }
  const bos = planBosAlanIdleri(tarih).map(id=>(dizimAlaniBul(id)||{}).ad).filter(Boolean);
  if(bos.length) cikti.push(`${bos.join(', ')} boş — atama yok.`);
  return cikti;
}
```

- [ ] **Step 4: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "plan türetimleri: bölme çeşidi, karışma uyarısı, boş alanlar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Çalışma işaretinin plandan türetilmesi

**Files:**
- Modify: `scv-saha-v1.html:3188-3189` (`tarlaKirimYapiliyorMu`, `seraDolduruluyorMu`)
- Modify: `scv-saha-v1.html` — Task 3'ün sonuna iki yardımcı
- Test: `tests/run.js` (yeni "Saha Planlama — çalışma işareti" bölümü)

**Interfaces:**
- Consumes: `planBul`, `todayStr` (Task 1)
- Produces:
  `bugunPlanTarlaIdleri() -> string[]`,
  `bugunPlanSeraIdleri() -> string[]`
- Değişen davranış: `tarlaKirimYapiliyorMu(t)` ve `seraDolduruluyorMu(s)` artık plandan da true dönebilir.

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — çalışma işareti türetimi
   Mevcut işaret bayrak değil TARİH tutuyor; gece yarısı kendiliğinden düşüyor.
   Plan bu alanlara YAZMAZ, işaret plandan türetilir — temizlik derdi doğmasın.
   --------------------------------------------------------------- */
bolum('Saha Planlama — çalışma işareti');
{
  const { app, T, a1 } = planOrtami();
  const bugun = app.todayStr();
  const t0 = app.tarlaBul('t0'), s0 = app.seraBul('s0');

  yanlis(app.tarlaKirimYapiliyorMu(t0), 'plan yokken tarla işareti kapalı');
  yanlis(app.seraDolduruluyorMu(s0), 'plan yokken sera işareti kapalı');

  // Yarının planı bugünü etkilemez
  const plan = app.planGetir(T); // 2026-08-05, bugünden farklı
  const bY = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, bY, 't0', 'traktor1', 'Ahmet');
  app.planSeraEkle(T, a1, bY, 's0');
  yanlis(app.tarlaKirimYapiliyorMu(t0), 'başka günün planı bugünkü işareti yakmaz');
  yanlis(app.seraDolduruluyorMu(s0), 'başka günün planı sera işaretini yakmaz');

  // Bugünün planı işareti yakar
  const bugunPlan = app.planGetir(bugun);
  const bB = app.planAlanGetir(bugunPlan, a1).bolmeler[0].id;
  app.planGirisEkle(bugun, a1, bB, 't0', 'traktor1', 'Ahmet');
  app.planSeraEkle(bugun, a1, bB, 's0');
  dogru(app.tarlaKirimYapiliyorMu(t0), 'bugünkü plan tarla işaretini yakar');
  dogru(app.seraDolduruluyorMu(s0), 'bugünkü plan sera işaretini yakar');

  // Kırım kaydına dönüşen bölme artık "yapılıyor" değildir
  app.planBolmeBul(bugunPlan, a1, bB).kirimId = 'k1';
  yanlis(app.tarlaKirimYapiliyorMu(t0), 'kayda dönüşen bölme tarla işaretini düşürür');
  yanlis(app.seraDolduruluyorMu(s0), 'kayda dönüşen bölme sera işaretini düşürür');
  app._temizle();
}
{ // Elle konan işaret plandan bağımsız çalışmaya devam eder
  const { app } = planOrtami();
  const t0 = app.tarlaBul('t0'), s0 = app.seraBul('s0');
  app.calismaIsaretiUygula(t0, 'kirimIsaretTarihi', true);
  app.seraIsaretiUygula(s0, 'doldurma');
  dogru(app.tarlaKirimYapiliyorMu(t0), 'elle işaret hâlâ çalışır');
  dogru(app.seraDolduruluyorMu(s0), 'elle sera işareti hâlâ çalışır');
  app._temizle();
}
{ // Boşaltma işareti plandan etkilenmez — plan yalnız doldurma yönünü tarifler
  const { app, a1 } = planOrtami();
  const bugun = app.todayStr();
  const plan = app.planGetir(bugun);
  const b = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planSeraEkle(bugun, a1, b, 's0');
  yanlis(app.seraBosaltiliyorMu(app.seraBul('s0')), 'plan boşaltma işaretini yakmaz');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — "bugünkü plan tarla işaretini yakar" iddiası `beklenen: true / gerçek: false`.

- [ ] **Step 3: Yardımcıları yaz**

Task 3'ün sonuna ekle:

```js
/* ---- Çalışma işareti türetimi ----
   Plan, tarla/sera kaydına İŞARET YAZMAZ. Yazsaydı: planı değiştirmek eski
   işareti temizlemeyi gerektirirdi ve unutulan her işaret yanlış bilgi olurdu.
   Türetince plan neyse işaret o; üstelik mevcut "gece yarısı düşer" kuralı
   bedavaya geliyor, çünkü yalnız BUGÜNÜN planına bakılıyor.
   Kırım kaydına dönüşmüş bölme sayılmaz: işaretin anlamı zaten
   "iş sürüyor ama kayıt henüz girilmedi" penceresi. */
function bugunPlanAktifBolmeler(){
  const plan = planBul(todayStr());
  if(!plan) return [];
  return plan.alanlar.flatMap(a=>a.bolmeler).filter(b=>!b.kirimId);
}
function bugunPlanTarlaIdleri(){
  return [...new Set(bugunPlanAktifBolmeler().flatMap(b=>b.girisler.map(g=>g.tarlaId)))];
}
function bugunPlanSeraIdleri(){
  return [...new Set(bugunPlanAktifBolmeler().flatMap(b=>b.seraIds))];
}
```

- [ ] **Step 4: İki yüklem fonksiyonunu genişlet**

`scv-saha-v1.html:3188-3189` — iki satırı değiştir:

```js
function tarlaKirimYapiliyorMu(t){ return !!t && (t.kirimIsaretTarihi === todayStr() || bugunPlanTarlaIdleri().includes(t.id)); }
function seraDolduruluyorMu(s){ return !!s && (s.doldurmaIsaretTarihi === todayStr() || bugunPlanSeraIdleri().includes(s.id)); }
```

`seraBosaltiliyorMu` **değişmez** — plan yalnız doldurma yönünü tarifler.

Yukarıdaki blok açıklamasına (3184-3187 satırlarındaki yorum) şu cümleyi ekle:

```js
   İşaret ayrıca BUGÜNÜN saha planından da türetilir (bkz. bugunPlanTarlaIdleri):
   plan işaret yazmaz, okunur — böylece plan değişince temizlik gerekmez.
```

- [ ] **Step 5: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS — yeni bölüm ve eski işaret testleri birlikte geçer.

- [ ] **Step 6: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "çalışma işareti bugünkü saha planından türetilir

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Sekme iskeleti — Genel Bilgiler / Saha Planlama

**Files:**
- Modify: `scv-saha-v1.html:1727-1754` (orta panel `<div class="panel">`)
- Modify: `scv-saha-v1.html:3354` (`renderSahaSayfasi`)
- Modify: `scv-saha-v1.html:2230` civarı (`I18N_EN` sözlüğü)
- Test: `tests/run.js` (yeni "Saha Planlama — sekmeler" bölümü)

**Interfaces:**
- Produces:
  `sahaGenelSekmeAktif` (let, `'genel'` | `'planlama'`),
  `sahaGenelSekmeGecis(sekme)`,
  `renderSahaPlanlama()` (bu task'ta yalnız iskelet: başlık + tarih + uyarılar)
  `planSeciliTarih` (let, varsayılan `todayStr()`),
  `planTarihSecildi(deger)`, `planTarihKaydir(gunFarki)`
- DOM kimlikleri: `sahaGenelTab_genel`, `sahaGenelTab_planlama`, `sahaGenelIcerikGenel`, `sahaGenelIcerikPlanlama`, `planTarihInput`, `planUyarilar`, `planSema`

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — sekme geçişi
   --------------------------------------------------------------- */
bolum('Saha Planlama — sekmeler');
{
  const app = kur();
  const b = app._belge;
  esit(app.sahaGenelSekmeAktif, 'genel', 'varsayılan sekme Genel Bilgiler');

  app.sahaGenelSekmeGecis('planlama');
  esit(app.sahaGenelSekmeAktif, 'planlama', 'sekme değişir');
  dogru(b.getElementById('sahaGenelIcerikGenel').classList.contains('hidden'), 'genel içerik gizlenir');
  yanlis(b.getElementById('sahaGenelIcerikPlanlama').classList.contains('hidden'), 'planlama içeriği görünür');
  dogru(b.getElementById('sahaGenelTab_planlama').classList.contains('active'), 'planlama sekmesi etkin');
  yanlis(b.getElementById('sahaGenelTab_genel').classList.contains('active'), 'genel sekmesi etkin değil');
  dogru(b.getElementById('sahaGenelPanelBox').classList.contains('panel-fullscreen'), 'planlamada panel tam ekran açılır');

  app.sahaGenelSekmeGecis('genel');
  esit(app.sahaGenelSekmeAktif, 'genel', 'geri dönülür');
  yanlis(b.getElementById('sahaGenelIcerikGenel').classList.contains('hidden'), 'genel içerik geri gelir');
  yanlis(b.getElementById('sahaGenelPanelBox').classList.contains('panel-fullscreen'), 'genele dönünce tam ekran kapanır');
  app._temizle();
}
{ // Tarih gezinme
  const app = kur();
  app.planTarihSecildi('2026-08-05');
  esit(app.planSeciliTarih, '2026-08-05', 'tarih seçilir');
  app.planTarihKaydir(1);
  esit(app.planSeciliTarih, '2026-08-06', 'bir gün ileri');
  app.planTarihKaydir(-2);
  esit(app.planSeciliTarih, '2026-08-04', 'iki gün geri');
  app.planTarihSecildi('');
  esit(app.planSeciliTarih, app.todayStr(), 'boş tarih bugüne düşer');
  app._temizle();
}
{ // Uyarılar seçili günün planından çizilir
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli');
  app.sahaGenelSekmeGecis('planlama'); // render sekme kapalıyken erken çıkar
  app.planTarihSecildi(T);
  const html = app._belge.getElementById('planUyarilar').innerHTML;
  dogru(html.includes('karış'), 'karışma uyarısı ekrana yazılır');
  dogru(html.includes('D.A2'), 'boş alan uyarısı ekrana yazılır');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.sahaGenelSekmeGecis is not a function`.

- [ ] **Step 3: HTML'i değiştir**

`scv-saha-v1.html:1727-1754` — orta paneli aşağıdakiyle değiştir. Mevcut `orta-body` içeriği **olduğu gibi** `sahaGenelIcerikGenel` sarmalayıcısının içine taşınır:

```html
    <!-- ORTA -->
    <div class="panel" id="sahaGenelPanelBox">
      <div class="panel-head">
        <h2 data-i18n="Saha Genel">Saha Genel</h2>
        <div class="panel-head-left">
          <div class="page-tabs" id="sahaGenelTabs">
            <button class="tab-btn active" id="sahaGenelTab_genel" onclick="sahaGenelSekmeGecis('genel')" data-i18n="Genel Bilgiler">Genel Bilgiler</button>
            <button class="tab-btn" id="sahaGenelTab_planlama" onclick="sahaGenelSekmeGecis('planlama')" data-i18n="Saha Planlama">Saha Planlama</button>
          </div>
        </div>
        <div class="satir-ortali-dar">
          <button class="icon-btn fullscreen-close" onclick="sahaGenelSekmeGecis('genel')" title="Tam Ekranı Kapat" data-i18n-title="Tam Ekranı Kapat">×</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="orta-body" id="sahaGenelIcerikGenel">
          <!-- MEVCUT İÇERİK BURAYA OLDUĞU GİBİ TAŞINIR:
               <h1>🌿 SCV</h1> … <div class="uyarilar-box" id="sahaUyarilar"></div> -->
        </div>
        <div class="plan-body hidden" id="sahaGenelIcerikPlanlama">
          <div class="plan-arac-cubugu">
            <button class="icon-btn ghost" onclick="planTarihKaydir(-1)" title="Önceki gün" data-i18n-title="Önceki gün">‹</button>
            <input type="date" id="planTarihInput" onchange="planTarihSecildi(this.value)">
            <button class="icon-btn ghost" onclick="planTarihKaydir(1)" title="Sonraki gün" data-i18n-title="Sonraki gün">›</button>
            <button class="btn" onclick="planDunuKopyala()" data-i18n="📋 Dünü Kopyala">📋 Dünü Kopyala</button>
            <button class="btn" id="planDegistirBtn" onclick="planDegistirUygula()" disabled data-i18n="⇄ Değiştir">⇄ Değiştir</button>
            <button class="btn" id="planSecimBirakBtn" onclick="planSecimBirak()" disabled data-i18n="× Seçimi bırak">× Seçimi bırak</button>
            <button class="btn" onclick="openDizimAlaniYonetimModal()" data-i18n="⚙ Dizim Alanları">⚙ Dizim Alanları</button>
          </div>
          <div class="plan-sema" id="planSema"></div>
          <div class="uyarilar-box" id="planUyarilar"></div>
        </div>
      </div>
    </div>
```

**Dikkat:** Orta panele artık `id="sahaGenelPanelBox"` verildi. `renderQuickStats` ve `renderSahaUyarilar` içindeki `qs*` / `sahaUyarilar` kimlikleri değişmedi, taşınan içerikte aynen kalmalı.

- [ ] **Step 4: CSS ekle**

`scv-saha-v1.html` — `/* ---------- SOL: DIZIM ALANI ---------- */` (529) bloğunun **hemen öncesine**:

```css
/* ---------- SAHA PLANLAMA ---------- */
.plan-body{display:flex;flex-direction:column;gap:var(--sp-2);min-height:0;}
.plan-arac-cubugu{display:flex;align-items:center;gap:var(--sp-1);flex-wrap:wrap;}
.plan-arac-cubugu input[type=date]{font:inherit;padding:2px 6px;border:1px solid var(--border);border-radius:var(--r-xs);background:var(--surface);color:var(--ink);}
.plan-sema{position:relative;overflow:auto;flex:1;min-height:220px;}
```

- [ ] **Step 5: JS'i yaz**

`renderSahaSayfasi` (3354) fonksiyonunun **hemen öncesine** ekle:

```js
/* =========================================================
   SAHA PLANLAMA — EKRAN
   Şema dar orta sütuna sığmaz; bu yüzden Saha Planlama sekmesi seçilince
   panel mevcut tam ekran mekanizmasıyla açılır, Genel Bilgiler'e dönünce kapanır.
   ========================================================= */
let sahaGenelSekmeAktif = 'genel';
let planSeciliTarih = todayStr();

function sahaGenelSekmeGecis(sekme){
  sahaGenelSekmeAktif = (sekme==='planlama') ? 'planlama' : 'genel';
  const planlamaMi = sahaGenelSekmeAktif==='planlama';
  document.getElementById('sahaGenelTab_genel').classList.toggle('active', !planlamaMi);
  document.getElementById('sahaGenelTab_planlama').classList.toggle('active', planlamaMi);
  document.getElementById('sahaGenelIcerikGenel').classList.toggle('hidden', planlamaMi);
  document.getElementById('sahaGenelIcerikPlanlama').classList.toggle('hidden', !planlamaMi);
  if(planlamaMi) panelTamEkranAc('sahaGenelPanelBox');
  else panelTamEkranKapat('sahaGenelPanelBox');
  if(planlamaMi) renderSahaPlanlama();
}
function planTarihSecildi(deger){
  planSeciliTarih = /^\d{4}-\d{2}-\d{2}$/.test(deger||'') ? deger : todayStr();
  renderSahaPlanlama();
}
/* Tarih aritmetiği UTC üzerinden: yerel saatte yaz saati geçişi olan günlerde
   +1 gün 23 ya da 25 saat sürer ve gün atlaması bozulur. */
function planTarihKaydir(gunFarki){
  const d = new Date(planSeciliTarih + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + gunFarki);
  planTarihSecildi(d.toISOString().slice(0,10));
}
function renderSahaPlanlama(){
  if(sahaGenelSekmeAktif!=='planlama') return;
  const tarihEl = document.getElementById('planTarihInput');
  if(tarihEl) tarihEl.value = planSeciliTarih;
  const uyariEl = document.getElementById('planUyarilar');
  if(uyariEl){
    const u = planUyarilari(planSeciliTarih);
    uyariEl.innerHTML = u.length
      ? u.map(m=>`<div class="uyari-satiri">⚠ ${escapeHtml(m)}</div>`).join('')
      : `<div class="uyari-satiri">${i18n('Uyarı yok.')}</div>`;
  }
}
```

`renderSahaSayfasi` (3354) içine, `renderSahaUyarilar();` satırının ardına ekle:

```js
  renderSahaPlanlama();
```

- [ ] **Step 6: i18n girdilerini ekle**

`I18N_EN` sözlüğünde `'Saha Genel':'Farm Overview',` satırının yanına ekle:

```js
  'Genel Bilgiler':'General Info', 'Saha Planlama':'Field Planning',
  'Önceki gün':'Previous day', 'Sonraki gün':'Next day',
  '📋 Dünü Kopyala':'📋 Copy Yesterday', '⇄ Değiştir':'⇄ Swap',
  '× Seçimi bırak':'× Clear selection', '⚙ Dizim Alanları':'⚙ Stringing Areas',
  'Uyarı yok.':'No warnings.',
```

- [ ] **Step 7: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 8: Tarayıcıda gözle doğrula**

`scv-saha-v1.html` dosyasını tarayıcıda aç. Saha Krokisi sayfasında orta panelde iki sekme görünmeli; **Saha Planlama**'ya basınca panel tam ekrana açılmalı, tarih bugüne ayarlı gelmeli, uyarı kutusunda "D.A1, D.A2 … boş — atama yok." yazmalı; `×` ile Genel Bilgiler'e dönülmeli.

- [ ] **Step 9: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "saha genel paneline genel bilgiler / saha planlama sekmeleri

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Şema render — üç sütun, kutular, bölmeler

**Files:**
- Modify: `scv-saha-v1.html` — Task 5'te açılan CSS bloğu ve `renderSahaPlanlama`
- Test: `tests/run.js` (yeni "Saha Planlama — şema çizimi" bölümü)

**Interfaces:**
- Consumes: `planBul`, `planBolmeEtiketi`, `planBolmeKarisikMi`, `dizimAlanlariSirali`, `seraGuncelDolu`, `seraDurumSinifiExact`, `aracBul`
- Produces:
  `planSemaTarlaIdleri(tarih) -> string[]` (soldaki sütunda görünecek tarlalar, ad sırasıyla),
  `planSemaHtml(tarih) -> string`,
  `renderSahaPlanlama()` artık `#planSema` içini de doldurur

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — şema çizimi
   Şema kullanıcının tek bilgi kaynağı; boş alanın görünür kalması ve
   kutulardaki kimliklerin doğru basılması davranışın kendisi.
   --------------------------------------------------------------- */
bolum('Saha Planlama — şema çizimi');
{
  const { app, T, a1 } = planOrtami();
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  const html = app._belge.getElementById('planSema').innerHTML;

  dogru(html.includes('D.A1'), 'boş planda bile dizim alanları çizilir');
  dogru(html.includes('D.B4'), '8 alanın sonuncusu da çizilir');
  dogru(html.includes('plan-alan-bos'), 'boş alan solgun sınıfla işaretlenir');
  yanlis(html.includes('K11'), 'plana bağlanmamış tarla sol sütunda görünmez');
  app._temizle();
}
{
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a1, b1, 't1', 'traktor1', 'Ahmet');
  app.planSeraEkle(T, a1, b1, 's0');
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  const html = app._belge.getElementById('planSema').innerHTML;

  dogru(html.includes('K11') && html.includes('K21'), 'bağlanan tarlalar sol sütunda');
  dogru(html.includes('BSB 6195'), 'bölme çeşidi yazılır');
  dogru(html.includes('Ahmet'), 'şoför adı görünür');
  dogru(html.includes('Traktör 1'), 'araç adı görünür');
  dogru(html.includes('D1'), 'hedef sera sağ sütunda');
  dogru(html.includes(app.planSemaTarlaIdleri(T)[0]), 'tarla kimliği kutuya basılır');
  esit(app.planSemaTarlaIdleri(T), ['t0','t1'], 'sol sütun tarlaları ad sırasıyla');
  app._temizle();
}
{ // Karışık bölme kırmızı sınıf alır
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  yanlis(app._belge.getElementById('planSema').innerHTML.includes('plan-bolme-karisik'), 'tek çeşitte uyarı sınıfı yok');

  app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli');
  app.renderSahaPlanlama();
  dogru(app._belge.getElementById('planSema').innerHTML.includes('plan-bolme-karisik'), 'karışık bölme uyarı sınıfı alır');
  app._temizle();
}
{ // Dizim alanı hiç yoksa yönlendirme çıkar
  const app = kur();
  app.state.dizimAlanlari = [];
  app.planTarihSecildi('2026-08-05');
  app.sahaGenelSekmeGecis('planlama');
  dogru(app._belge.getElementById('planSema').innerHTML.includes('Dizim alanı yok'), 'alan yoksa yönlendirme gösterilir');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `#planSema` boş, `app.planSemaTarlaIdleri is not a function`.

- [ ] **Step 3: CSS'i genişlet**

Task 5'te eklenen `/* ---------- SAHA PLANLAMA ---------- */` bloğunun sonuna ekle:

```css
.plan-sutunlar{display:grid;grid-template-columns:minmax(96px,1fr) minmax(150px,1.4fr) minmax(120px,1.3fr);gap:var(--sp-3);align-items:start;position:relative;}
.plan-sutun-baslik{font-size:var(--fs-xs);font-weight:var(--fw-kalin);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:var(--sp-1);}
.plan-kutu{border:2px solid var(--border-strong);border-radius:var(--r-sm);background:var(--surface);padding:var(--sp-1) var(--sp-2);cursor:pointer;position:relative;}
.plan-kutu.sel{border-color:var(--green-700);box-shadow:0 0 0 3px var(--green-100);}
.plan-tarla{border-color:var(--green-700);margin-bottom:var(--sp-2);}
.plan-tarla b{display:block;font-size:var(--fs-md);font-weight:var(--fw-kalin);}
.plan-tarla span{display:block;font-size:var(--fs-xs);color:var(--muted);}
.plan-alan{padding:0;margin-bottom:var(--sp-2);overflow:hidden;}
.plan-alan-bos{opacity:.45;}
.plan-alan-bas{display:flex;align-items:baseline;justify-content:space-between;gap:var(--sp-1);padding:var(--sp-1) var(--sp-2);border-bottom:1px solid var(--border);}
.plan-alan-bas b{font-size:var(--fs-lg);font-weight:var(--fw-kalin);}
.plan-alan-rozet{font-size:var(--fs-xs);letter-spacing:.08em;color:var(--muted);}
.plan-bolme{padding:var(--sp-1) var(--sp-2);border-top:1px dashed var(--border);cursor:pointer;}
.plan-alan .plan-bolme:first-of-type{border-top:none;}
.plan-bolme.sel{background:var(--green-100);}
.plan-bolme-karisik{border-left:3px solid var(--red);background:var(--red-soft);}
.plan-bolme-bas{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-1);}
.plan-bolme-cesit{font-size:var(--fs-sm);font-weight:var(--fw-orta);}
.plan-giris{font-size:var(--fs-xs);color:var(--muted);display:flex;align-items:center;gap:4px;}
.plan-giris-nokta{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.plan-alan-dugmeler{display:flex;gap:var(--sp-1);padding:var(--sp-1) var(--sp-2);border-top:1px solid var(--border);}
.plan-sera-grup{display:flex;flex-wrap:wrap;gap:var(--sp-1);margin-bottom:var(--sp-2);}
.plan-sera{min-width:52px;text-align:center;padding:var(--sp-1);}
.plan-sera b{display:block;font-size:var(--fs-sm);font-weight:var(--fw-kalin);}
.plan-sera-cubuk{height:4px;border-radius:var(--r-pill);background:var(--border);margin:3px 0 2px;overflow:hidden;}
.plan-sera-cubuk i{display:block;height:100%;}
.plan-sera-pct{font-size:var(--fs-xs);color:var(--muted);}
.plan-sera-dolu{opacity:.5;}
```

- [ ] **Step 4: Şema çizimini yaz**

`renderSahaPlanlama` fonksiyonundan **önce** ekle:

```js
/* Sol sütun yalnız PLANA BAĞLI tarlaları gösterir: sahada 25+ tarla var,
   hepsini çizmek şemayı okunmaz yapardı. Yeni tarla "+ Tarla" ile eklenir. */
function planSemaTarlaIdleri(tarih){
  const plan = planBul(tarih);
  if(!plan) return [];
  const idler = [...new Set(plan.alanlar.flatMap(a=>a.bolmeler.flatMap(b=>b.girisler.map(g=>g.tarlaId))))];
  return idler.filter(tarlaBul).sort((x,y)=>
    ((tarlaBul(x)||{}).ad||'').localeCompare(((tarlaBul(y)||{}).ad||''),'tr',{numeric:true}));
}
function planSeraKutusuHtml(seraId, alanId, bolmeId){
  const s = seraBul(seraId);
  if(!s) return '';
  const pct = s.kapasite>0 ? (seraGuncelDolu(s)/s.kapasite*100) : 0;
  const doluMu = pct >= 100;
  return `<div class="plan-kutu plan-sera${doluMu?' plan-sera-dolu':''}${planSecimEsitMi('sera',seraId)?' sel':''}"
      data-plan-sera="${seraId}" onclick="planSeraTikla('${seraId}','${alanId}','${bolmeId}')">
    <b>${escapeHtml(s.ad)}</b>
    <div class="plan-sera-cubuk"><i class="${seraDurumSinifiExact(pct)}" style="width:${Math.min(pct,100)}%"></i></div>
    <div class="plan-sera-pct">${fmt(pct,0)}%</div>
  </div>`;
}
function planBolmeHtml(alanId, bolme, sira){
  const girisler = bolme.girisler.map(g=>{
    const t = tarlaBul(g.tarlaId), arac = aracBul(g.aracId);
    return `<div class="plan-giris">
      <span class="plan-giris-nokta" style="background:${arac?arac.renk:'var(--border-strong)'}"></span>
      ${escapeHtml((t&&t.ad)||'?')} · ${escapeHtml(arac?arac.ad:i18n('araç yok'))}${g.sofor?' · '+escapeHtml(g.sofor):''}
      <button class="dizim-del" title="${i18n('Kaldır')}" onclick="event.stopPropagation();planGirisKaldirTikla('${alanId}','${bolme.id}','${g.tarlaId}')">×</button>
    </div>`;
  }).join('');
  return `<div class="plan-bolme${planBolmeKarisikMi(bolme)?' plan-bolme-karisik':''}${planSecimEsitMi('bolme',bolme.id)?' sel':''}"
      data-plan-bolme="${bolme.id}" onclick="planBolmeTikla('${alanId}','${bolme.id}')">
    <div class="plan-bolme-bas">
      <span class="plan-bolme-cesit">${sira}. ${escapeHtml(planBolmeEtiketi(bolme))}</span>
      <button class="icon-btn kare-ikon-dugmesi" title="${i18n('Kırım Kaydına Dönüştür')}"
        onclick="event.stopPropagation();planBolmedenKirimAc('${alanId}','${bolme.id}')">${bolme.kirimId?'✓':'‹'}</button>
    </div>
    ${girisler || `<div class="plan-giris">${i18n('tarla yok')}</div>`}
  </div>`;
}
function planSemaHtml(tarih){
  const alanlar = dizimAlanlariSirali();
  if(!alanlar.length){
    return `<div class="empty-hint">${i18n('Dizim alanı yok. "⚙ Dizim Alanları" ile ekleyin.')}</div>`;
  }
  const plan = planBul(tarih);
  const tarlaSutun = planSemaTarlaIdleri(tarih).map(id=>{
    const t = tarlaBul(id);
    return `<div class="plan-kutu plan-tarla${planSecimEsitMi('tarla',id)?' sel':''}"
        data-plan-tarla="${id}" onclick="planTarlaTikla('${id}')">
      <b>${escapeHtml(t.ad||'-')}</b><span>${escapeHtml(t.cesit||'—')}</span>
    </div>`;
  }).join('') + `<button class="btn" onclick="openPlanTarlaSecModal()" data-i18n="+ Tarla">${i18n('+ Tarla')}</button>`;

  const alanSutun = alanlar.map(al=>{
    const a = plan && plan.alanlar.find(x=>x.alanId===al.id);
    const bolmeler = a ? a.bolmeler : [];
    const bosMu = !bolmeler.some(b=>b.girisler.length || b.seraIds.length);
    const kisaAd = al.ad.replace(/^D\./,'');
    return `<div class="plan-kutu plan-alan${bosMu?' plan-alan-bos':''}${planSecimEsitMi('alan',al.id)?' sel':''}"
        data-plan-alan="${al.id}" onclick="planAlanTikla('${al.id}')">
      <div class="plan-alan-bas"><b>${escapeHtml(kisaAd)}</b><span class="plan-alan-rozet">${i18n('DİZİM')}</span></div>
      ${bolmeler.map((b,i)=>planBolmeHtml(al.id, b, i+1)).join('')}
      <div class="plan-alan-dugmeler">
        <button class="btn" onclick="event.stopPropagation();planBolmeEkleTikla('${al.id}')" title="${i18n('Böl')}">⊞</button>
        <button class="btn" onclick="event.stopPropagation();planBolmeBirlestirTikla('${al.id}')" title="${i18n('Birleştir')}">⊟</button>
      </div>
    </div>`;
  }).join('');

  const seraSutun = alanlar.map(al=>{
    const a = plan && plan.alanlar.find(x=>x.alanId===al.id);
    const kutular = (a ? a.bolmeler : []).flatMap(b=>b.seraIds.map(sid=>planSeraKutusuHtml(sid, al.id, b.id))).join('');
    return `<div class="plan-sera-grup" data-plan-sera-grup="${al.id}">${kutular}</div>`;
  }).join('');

  return `<div class="plan-sutunlar">
    <div><div class="plan-sutun-baslik">${i18n('Tarlalar')}</div>${tarlaSutun}</div>
    <div><div class="plan-sutun-baslik">${i18n('Dizim Alanları')}</div>${alanSutun}</div>
    <div><div class="plan-sutun-baslik">${i18n('Seralar')}</div>${seraSutun}</div>
  </div>`;
}
```

`renderSahaPlanlama` içine, tarih atamasından sonra ve uyarılardan önce ekle:

```js
  const semaEl = document.getElementById('planSema');
  if(semaEl) semaEl.innerHTML = planSemaHtml(planSeciliTarih);
```

- [ ] **Step 5: Geçici seçim/tıklama saplamalarını ekle**

Task 7 seçim mantığını yazana kadar şema render'ı çalışsın diye, `planSemaTarlaIdleri`'nin **öncesine** ekle:

```js
/* Seçim durumu Task 7'de doldurulur; şema render'ı buradan okur. */
let planSecim = null; // { tur:'tarla'|'alan'|'bolme'|'sera', id, alanId, bolmeId }
function planSecimEsitMi(tur, id){ return !!planSecim && planSecim.tur===tur && planSecim.id===id; }
```

- [ ] **Step 6: i18n girdilerini ekle**

```js
  'Dizim Alanları':'Stringing Areas', 'DİZİM':'STRING', 'Böl':'Split', 'Birleştir':'Merge',
  '+ Tarla':'+ Field', 'tarla yok':'no field', 'araç yok':'no vehicle', 'Kaldır':'Remove',
  'Kırım Kaydına Dönüştür':'Convert to Harvest Record',
  'Dizim alanı yok. "⚙ Dizim Alanları" ile ekleyin.':'No stringing areas. Add them with "⚙ Stringing Areas".',
```

- [ ] **Step 7: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "saha planlama şeması: üç sütun, dizim alanı kutuları, bölmeler

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Seçim, bağlama ve takas etkileşimi

**Files:**
- Modify: `scv-saha-v1.html` — Task 6'daki `planSecim` saplaması gerçek mantıkla değiştirilir
- Test: `tests/run.js` (yeni "Saha Planlama — seçim ve bağlama" bölümü)

**Interfaces:**
- Consumes: Task 2 mutasyonları, Task 6 render
- Produces:
  `planSecimBirak()`,
  `planSecimAyarla(tur, id, alanId, bolmeId)`,
  `planTarlaTikla(tarlaId)`, `planAlanTikla(alanId)`, `planBolmeTikla(alanId, bolmeId)`, `planSeraTikla(seraId, alanId, bolmeId)`,
  `planDegistirUygula()`,
  `planBolmeEkleTikla(alanId)`, `planBolmeBirlestirTikla(alanId)`, `planGirisKaldirTikla(alanId, bolmeId, tarlaId)`,
  `openPlanTarlaSecModal()`, `openPlanGirisModal(alanId, bolmeId, tarlaId)`, `submitPlanGiris(alanId, bolmeId, tarlaId)`,
  `planDegistirDugmeleriGuncelle()`

**Etkileşim kuralları (uygulanacak davranış):**
1. Boştayken bir kutuya tıklamak onu seçer.
2. **Tarla seçiliyken bölmeye** tıklamak → araç/şoför soran kip açılır, onayla giriş eklenir, seçim bırakılır.
3. **Bölme seçiliyken seraya** tıklamak → sera o bölmeye taşınır, seçim bırakılır.
4. Aynı türden ikinci kutuya tıklamak → ikinci seçim olur ve `⇄ Değiştir` etkinleşir.
5. Seçili kutuya tekrar tıklamak → seçim bırakılır.
6. Uyumsuz tür çiftlerinde (ör. tarla + sera) yeni tıklanan kutu tek seçim olur.

- [ ] **Step 1: Testleri yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — seçim ve bağlama
   "Futbol değişikliği": iki aynı türden kutu seçilir, Değiştir'e basılır.
   --------------------------------------------------------------- */
bolum('Saha Planlama — seçim ve bağlama');
{
  const { app, T, a1, a2 } = planOrtami();
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  const b = app._belge;

  app.planTarlaTikla('t0');
  dogru(app.planSecimEsitMi('tarla','t0'), 'tarla seçilir');
  dogru(b.getElementById('planDegistirBtn').disabled, 'tek seçimde Değiştir kapalı');
  yanlis(b.getElementById('planSecimBirakBtn').disabled, 'seçim varken bırak açık');

  app.planTarlaTikla('t0');
  yanlis(app.planSecimEsitMi('tarla','t0'), 'aynı kutuya tekrar tıklamak seçimi bırakır');
  dogru(b.getElementById('planSecimBirakBtn').disabled, 'seçim yokken bırak kapalı');
  app._temizle();
}
{ // Tarla → bölme bağlama (kip onayı submitPlanGiris ile taklit edilir)
  const { app, T, a1 } = planOrtami();
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;

  app.planTarlaTikla('t0');
  app.planBolmeTikla(a1, b1);            // araç/şoför kipini açar
  esit(app._belge.getElementById('modalContent').innerHTML.includes('Traktör 1'), true, 'araç seçenekleri kipte');

  app._belge.getElementById('planGirisArac').value = 'transit1';
  app._belge.getElementById('planGirisSofor').value = ' Ahmet ';
  app.submitPlanGiris(a1, b1, 't0');

  const bolme = app.planBolmeBul(plan, a1, b1);
  esit(bolme.girisler.length, 1, 'giriş eklendi');
  esit(bolme.girisler[0].aracId, 'transit1', 'seçilen araç yazıldı');
  esit(bolme.girisler[0].sofor, 'Ahmet', 'şoför adının boşlukları kırpıldı');
  esit(app.planSecim, null, 'bağlamadan sonra seçim bırakılır');
  app._temizle();
}
{ // Bölme → sera bağlama
  const { app, T, a1 } = planOrtami();
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;

  app.planBolmeTikla(a1, b1);
  dogru(app.planSecimEsitMi('bolme', b1), 'bölme seçildi');
  app.planSeraTikla('s0', '', '');
  esit(app.planBolmeBul(plan, a1, b1).seraIds, ['s0'], 'sera bölmeye bağlandı');
  esit(app.planSecim, null, 'bağlamadan sonra seçim bırakılır');
  app._temizle();
}
{ // İki tarla seçip Değiştir
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a2, b2, 't2', 'transit1', 'Veli');
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');

  app.planTarlaTikla('t0');
  app.planTarlaTikla('t2');
  yanlis(app._belge.getElementById('planDegistirBtn').disabled, 'iki aynı tür seçilince Değiştir açılır');
  app.planDegistirUygula();
  esit(app.planBolmeBul(plan, a1, b1).girisler[0].tarlaId, 't2', 'tarlalar takas edildi');
  esit(app.planSecim, null, 'takastan sonra seçim bırakılır');
  dogru(app._belge.getElementById('planDegistirBtn').disabled, 'takastan sonra Değiştir kapanır');
  app._temizle();
}
{ // Uyumsuz çift: tarla seçiliyken seraya tıklamak sadece serayı seçer
  const { app, T } = planOrtami();
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  app.planTarlaTikla('t0');
  app.planSeraTikla('s0', '', '');
  dogru(app.planSecimEsitMi('sera','s0'), 'sera tek seçim olur');
  dogru(app._belge.getElementById('planDegistirBtn').disabled, 'uyumsuz çiftte Değiştir kapalı');
  app._temizle();
}
{ // Bölme ekle / birleştir düğmeleri
  const { app, T, a1 } = planOrtami();
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  app.planBolmeEkleTikla(a1);
  esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 2, 'böl düğmesi bölme ekler');
  app.planBolmeBirlestirTikla(a1);
  esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 1, 'birleştir düğmesi bölme azaltır');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.planTarlaTikla is not a function`.

- [ ] **Step 3: Seçim ve tıklama mantığını yaz**

Task 6'daki geçici saplamayı (`let planSecim = null;` + `planSecimEsitMi`) aşağıdaki blokla **değiştir**:

```js
/* ---- Seçim ----
   İki yuva: birinci seçim bağlamanın kaynağı, ikinci seçim (aynı türdense)
   takasın öteki ucu. Futboldaki oyuncu değişikliği gibi: ikisi işaretlenir,
   sonra Değiştir'e basılır. */
let planSecim = null;   // { tur, id, alanId, bolmeId }
let planSecim2 = null;
function planSecimEsitMi(tur, id){
  return (!!planSecim && planSecim.tur===tur && planSecim.id===id)
      || (!!planSecim2 && planSecim2.tur===tur && planSecim2.id===id);
}
function planSecimBirak(){
  planSecim = null; planSecim2 = null;
  renderSahaPlanlama();
}
function planDegistirDugmeleriGuncelle(){
  const dg = document.getElementById('planDegistirBtn');
  const br = document.getElementById('planSecimBirakBtn');
  if(dg) dg.disabled = !(planSecim && planSecim2 && planSecim.tur===planSecim2.tur);
  if(br) br.disabled = !planSecim;
}
/* Tek giriş noktası: hangi kutuya tıklanırsa tıklansın buraya düşer.
   1) Aynı kutuya tekrar tıklamak seçimi bırakır.
   2) Bağlanabilir çift (tarla→bölme, bölme→sera) ise bağlar.
   3) Aynı türdense ikinci seçim olur (takas için).
   4) Aksi hâlde yeni kutu tek seçim olur. */
function planKutuSec(yeni){
  if(planSecim && planSecim.tur===yeni.tur && planSecim.id===yeni.id){ planSecimBirak(); return null; }
  if(planSecim2 && planSecim2.tur===yeni.tur && planSecim2.id===yeni.id){ planSecim2 = null; renderSahaPlanlama(); return null; }
  if(planSecim && planSecim.tur===yeni.tur){ planSecim2 = yeni; renderSahaPlanlama(); return null; }
  planSecim = yeni; planSecim2 = null;
  renderSahaPlanlama();
  return yeni;
}
function planTarlaTikla(tarlaId){
  planKutuSec({ tur:'tarla', id:tarlaId });
}
function planAlanTikla(alanId){
  planKutuSec({ tur:'alan', id:alanId });
}
function planBolmeTikla(alanId, bolmeId){
  // Tarla seçiliyken bölmeye dokunmak BAĞLAMA demektir; araç ve şoförü sorar.
  if(planSecim && planSecim.tur==='tarla'){
    const tarlaId = planSecim.id;
    planSecim = null; planSecim2 = null;
    openPlanGirisModal(alanId, bolmeId, tarlaId);
    return;
  }
  planKutuSec({ tur:'bolme', id:bolmeId, alanId });
}
function planSeraTikla(seraId, alanId, bolmeId){
  // Bölme seçiliyken seraya dokunmak BAĞLAMA demektir.
  if(planSecim && planSecim.tur==='bolme'){
    const hedefAlan = planSecim.alanId, hedefBolme = planSecim.id;
    planSecim = null; planSecim2 = null;
    const tasindi = !!seraBolmesiniBul(planSeciliTarih, seraId);
    planSeraEkle(planSeciliTarih, hedefAlan, hedefBolme, seraId);
    if(tasindi) uyar('Bu sera başka bir bölmedeydi, oradan alınıp buraya taşındı.');
    renderAll();
    return;
  }
  planKutuSec({ tur:'sera', id:seraId, alanId, bolmeId });
}
/* Bir seranın seçili günde hangi bölmede olduğunu bulur (taşıma bilgisi için). */
function seraBolmesiniBul(tarih, seraId){
  const plan = planBul(tarih);
  if(!plan) return null;
  for(const a of plan.alanlar){
    for(const b of a.bolmeler){ if(b.seraIds.includes(seraId)) return { alanId:a.alanId, bolmeId:b.id }; }
  }
  return null;
}
function planDegistirUygula(){
  if(!planSecim || !planSecim2 || planSecim.tur!==planSecim2.tur) return;
  const t = planSecim.tur, a = planSecim.id, b = planSecim2.id;
  if(t==='tarla') planTarlaTakas(planSeciliTarih, a, b);
  else if(t==='sera') planSeraTakas(planSeciliTarih, a, b);
  else if(t==='alan') planAlanTakas(planSeciliTarih, a, b);
  else { uyar('Bölmeler takas edilemez — bölme içeriğini "Böl / Birleştir" ile düzenleyin.'); return; }
  planSecim = null; planSecim2 = null;
  renderAll();
}
function planBolmeEkleTikla(alanId){
  if(!planBolmeEkle(planSeciliTarih, alanId)) uyar('Bir dizim alanı en çok 4 bölmeye ayrılabilir.');
  renderAll();
}
function planBolmeBirlestirTikla(alanId){
  if(!planBolmeBirlestir(planSeciliTarih, alanId)) uyar('Alanda tek bölme var, birleştirilecek bir şey yok.');
  renderAll();
}
function planGirisKaldirTikla(alanId, bolmeId, tarlaId){
  planGirisKaldir(planSeciliTarih, alanId, bolmeId, tarlaId);
  planCopTopla(planSeciliTarih);
  renderAll();
}
/* ---- Araç + şoför kipi ----
   Şoför adı serbest metin (her gün değişiyor) ama son 30 günün planlarında
   geçen adlar öneri olarak sunulur — "Ahmet / ahmet / Ahmet A." kaymasın. */
function planSoforOnerileri(){
  const sinir = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const kume = new Set();
  state.sahaPlanlari.forEach(p=>{
    if((p.tarih||'') < sinir) return;
    p.alanlar.forEach(a=>a.bolmeler.forEach(b=>b.girisler.forEach(g=>{ if(g.sofor) kume.add(g.sofor); })));
  });
  return [...kume].sort((x,y)=>x.localeCompare(y,'tr'));
}
function openPlanGirisModal(alanId, bolmeId, tarlaId){
  const t = tarlaBul(tarlaId) || {};
  const alanAd = (dizimAlaniBul(alanId)||{}).ad || '';
  openModal(`
    <h3>${escapeHtml(t.ad||'')} → ${escapeHtml(alanAd)}</h3>
    <div class="field"><label>${i18n('Araç')}</label>
      <select id="planGirisArac">${ARACLAR.map(a=>`<option value="${a.id}">${escapeHtml(a.ad)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>${i18n('Şoför')}</label>
      <input id="planGirisSofor" list="planSoforListe" placeholder="${i18n('Şoför adı')}">
      <datalist id="planSoforListe">${planSoforOnerileri().map(s=>`<option value="${escapeHtml(s)}"></option>`).join('')}</datalist>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">${i18n('Vazgeç')}</button>
      <button class="btn btn-primary" onclick="submitPlanGiris('${alanId}','${bolmeId}','${tarlaId}')">${i18n('Bağla')}</button>
    </div>`);
}
function submitPlanGiris(alanId, bolmeId, tarlaId){
  const arac = document.getElementById('planGirisArac').value;
  const sofor = document.getElementById('planGirisSofor').value;
  if(!planGirisEkle(planSeciliTarih, alanId, bolmeId, tarlaId, arac, sofor)){
    uyar('Bu tarla zaten bu bölmede.');
  }
  closeModal();
  renderAll();
}
/* Sol sütuna yeni tarla eklemek: tarlayı seçtirir, sonra kullanıcı bir bölmeye
   dokunarak bağlar. Doğrudan bağlamak, hangi bölmeye gideceğini bilmediğimiz
   için mümkün değil. */
function openPlanTarlaSecModal(){
  const liste = [...state.tarlalar].sort((a,b)=>(a.ad||'').localeCompare(b.ad||'','tr',{numeric:true}));
  openModal(`
    <h3>${i18n('Tarla Seç')}</h3>
    <div class="hint-text">${i18n('Tarlayı seçtikten sonra bir dizim alanı bölmesine dokunarak bağlayın.')}</div>
    <div class="tarla-tile-grid">${liste.map(t=>
      `<button class="tarla-tile" type="button" onclick="planTarlaSecildi('${t.id}')">${escapeHtml(t.ad||'-')}<span>${escapeHtml(t.cesit||'')}</span></button>`
    ).join('')}</div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">${i18n('Vazgeç')}</button></div>`);
}
function planTarlaSecildi(tarlaId){
  planSecim = { tur:'tarla', id:tarlaId };
  planSecim2 = null;
  closeModal();
  renderSahaPlanlama();
}
```

- [ ] **Step 4: `renderSahaPlanlama` sonunda düğme durumunu güncelle**

`renderSahaPlanlama` fonksiyonunun sonuna ekle:

```js
  planDegistirDugmeleriGuncelle();
```

- [ ] **Step 5: i18n girdilerini ekle**

```js
  'Araç':'Vehicle', 'Şoför':'Driver', 'Şoför adı':'Driver name', 'Bağla':'Connect',
  'Tarla Seç':'Select Field',
  'Tarlayı seçtikten sonra bir dizim alanı bölmesine dokunarak bağlayın.':'After selecting the field, tap a stringing area section to connect it.',
  'Bu tarla zaten bu bölmede.':'This field is already in this section.',
  'Bu sera başka bir bölmedeydi, oradan alınıp buraya taşındı.':'This greenhouse was in another section; it has been moved here.',
  'Bir dizim alanı en çok 4 bölmeye ayrılabilir.':'A stringing area can be split into at most 4 sections.',
  'Alanda tek bölme var, birleştirilecek bir şey yok.':'The area has a single section; nothing to merge.',
  'Bölmeler takas edilemez — bölme içeriğini "Böl / Birleştir" ile düzenleyin.':'Sections cannot be swapped — edit section contents with "Split / Merge".',
```

- [ ] **Step 6: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 7: Tarayıcıda gözle doğrula**

Tarayıcıda: bir tarlaya `+ Tarla` ile seçim yap, bir bölmeye dokun, araç/şoför kipinde bağla. Bölmeye dokunup bir seraya dokun. İki tarla seçip `⇄ Değiştir`in etkinleştiğini ve takas ettiğini gör.

- [ ] **Step 8: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "plan şemasında seçim, bağlama ve takas etkileşimi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Bağlantı çizgileri (SVG)

**Files:**
- Modify: `scv-saha-v1.html` — Task 5 CSS bloğu + Task 6 `planSemaHtml`/`renderSahaPlanlama`
- Test: gözle doğrulama (çizgi geometrisi DOM ölçümüne dayanır; sahte DOM'da `getBoundingClientRect` sıfır döndürdüğü için birim testi anlamlı olmaz — bunun yerine "ölçüm alınamıyorsa çizim atlanır" davranışı test edilir)

**Interfaces:**
- Consumes: Task 6 render, `ARACLAR`
- Produces: `planCizgileriCiz()` — `#planSema` içine mutlak konumlu bir `<svg>` yerleştirir

- [ ] **Step 1: Testi yaz (kırmızı)**

`tests/run.js` sonuna ekle:

```js
/* ---------------------------------------------------------------
   Saha Planlama — bağlantı çizgileri
   Geometri gerçek düzene bağlı; testin işi çizimin ölçüm alınamayan
   ortamda (ve şema boşken) patlamadan sessizce geçmesi.
   --------------------------------------------------------------- */
bolum('Saha Planlama — çizgiler');
{
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planSeraEkle(T, a1, b1, 's0');
  app.planTarihSecildi(T);
  app.sahaGenelSekmeGecis('planlama');
  app.planCizgileriCiz(); // ölçüm sıfır dönse de hata atmamalı
  dogru(true, 'ölçüm alınamayan ortamda çizim sessizce geçer');
  app._temizle();
}
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.planCizgileriCiz is not a function`.

- [ ] **Step 3: CSS ekle**

Task 5 CSS bloğunun sonuna:

```css
.plan-cizgi-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}
.plan-cizgi-svg path{fill:none;stroke-width:2.5;}
.plan-cizgi-svg text{font-size:10px;font-weight:700;paint-order:stroke;stroke:var(--surface);stroke-width:3px;}
```

- [ ] **Step 4: Çizim fonksiyonunu yaz**

`renderSahaPlanlama` fonksiyonundan **önce** ekle:

```js
/* Bağlantı çizgileri şemanın üstüne mutlak konumlu tek bir SVG olarak çizilir.
   Konumlar gerçek DOM ölçümünden alınır — kutu boyları içeriğe göre değiştiği
   için sabit koordinat hesaplamak mümkün değil. Ölçüm alınamayan ortamda
   (ör. test harness'ı, panel gizliyken) sessizce çıkılır: yarım çizilmiş
   çizgiler yanlış plan okumasına yol açardı. */
function planCizgileriCiz(){
  const kap = document.getElementById('planSema');
  if(!kap) return;
  const eski = kap.querySelector && kap.querySelector('.plan-cizgi-svg');
  if(eski) eski.remove();
  const kapKutu = kap.getBoundingClientRect();
  if(!kapKutu || !kapKutu.width) return;

  const plan = planBul(planSeciliTarih);
  if(!plan) return;
  const yollar = [];
  const merkezSag = el=>{ const r = el.getBoundingClientRect(); return { x:r.right-kapKutu.left+kap.scrollLeft, y:r.top+r.height/2-kapKutu.top+kap.scrollTop }; };
  const merkezSol = el=>{ const r = el.getBoundingClientRect(); return { x:r.left-kapKutu.left+kap.scrollLeft, y:r.top+r.height/2-kapKutu.top+kap.scrollTop }; };
  const egri = (a,b)=>`M${a.x},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x},${b.y}`;

  plan.alanlar.forEach(alan=>{
    alan.bolmeler.forEach(bolme=>{
      const bolmeEl = kap.querySelector(`[data-plan-bolme="${bolme.id}"]`);
      if(!bolmeEl) return;
      bolme.girisler.forEach(g=>{
        const tarlaEl = kap.querySelector(`[data-plan-tarla="${g.tarlaId}"]`);
        if(!tarlaEl) return;
        const arac = aracBul(g.aracId);
        const a = merkezSag(tarlaEl), b = merkezSol(bolmeEl);
        yollar.push(`<path d="${egri(a,b)}" stroke="${arac?arac.renk:'var(--border-strong)'}"></path>`);
        const etiket = [arac?arac.ad:'', g.sofor].filter(Boolean).join(' · ');
        if(etiket) yollar.push(`<text x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2-4}" text-anchor="middle" fill="${arac?arac.renk:'var(--muted)'}">${escapeHtml(etiket)}</text>`);
      });
      bolme.seraIds.forEach(sid=>{
        const seraEl = kap.querySelector(`[data-plan-sera="${sid}"]`);
        if(!seraEl) return;
        yollar.push(`<path d="${egri(merkezSag(bolmeEl), merkezSol(seraEl))}" stroke="var(--border-strong)"></path>`);
      });
    });
  });
  if(!yollar.length) return;
  kap.insertAdjacentHTML('beforeend', `<svg class="plan-cizgi-svg">${yollar.join('')}</svg>`);
}
```

- [ ] **Step 5: Render sonunda çağır**

`renderSahaPlanlama` içinde `planDegistirDugmeleriGuncelle();` **öncesine** ekle:

```js
  // Düzen oturduktan sonra ölç: aynı turda ölçmek eski kutu boylarını verir
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(planCizgileriCiz);
  else planCizgileriCiz();
```

- [ ] **Step 6: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 7: Tarayıcıda gözle doğrula**

Tarayıcıda: tarla → bölme çizgisi aracın renginde olmalı, üzerinde `Traktör 1 · Ahmet` yazmalı; bölme → sera çizgisi nötr renkte olmalı. Pencereyi yeniden boyutlandırınca çizgiler kaymamalı (yeniden çizim `renderSahaPlanlama` üzerinden gelir; kaymışsa `window.addEventListener('resize', planCizgileriCiz)` ekle).

- [ ] **Step 8: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "plan şemasına araç renkli bağlantı çizgileri

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Dizim alanı yönetim kipi

**Files:**
- Modify: `scv-saha-v1.html` — Task 7'nin sonuna
- Test: `tests/run.js` (yeni "Saha Planlama — alan yönetimi" bölümü)

**Interfaces:**
- Consumes: `dizimAlanlariSirali`, `dizimAlaniBul`, `state.sahaPlanlari`
- Produces:
  `dizimAlaniPlanSayisi(alanId) -> number`,
  `dizimAlaniEkle(ad) -> boolean`, `dizimAlaniAdDegistir(alanId, ad) -> boolean`, `dizimAlaniSil(alanId) -> boolean`,
  `openDizimAlaniYonetimModal()`, `submitDizimAlaniEkle()`, `dizimAlaniSilTikla(alanId)`

- [ ] **Step 1: Testleri yaz (kırmızı)**

```js
/* ---------------------------------------------------------------
   Saha Planlama — dizim alanı yönetimi
   Alan silmek geçmiş planlardaki atamaları da düşürür; kullanıcı kaç planda
   kullanıldığını GÖRMEDEN silmemeli.
   --------------------------------------------------------------- */
bolum('Saha Planlama — alan yönetimi');
{
  const { app, T, a1 } = planOrtami();
  esit(app.dizimAlaniPlanSayisi(a1), 0, 'kullanılmayan alan 0 planda');
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  esit(app.dizimAlaniPlanSayisi(a1), 1, 'kullanılan alan 1 planda');
  app._temizle();
}
{
  const { app } = planOrtami();
  esit(app.state.dizimAlanlari.length, 8, 'başlangıçta 8 alan');
  dogru(app.dizimAlaniEkle('D.C1'), 'yeni alan eklenir');
  esit(app.state.dizimAlanlari.length, 9, 'alan sayısı arttı');
  yanlis(app.dizimAlaniEkle('D.C1'), 'aynı adlı alan tekrar eklenmez');
  yanlis(app.dizimAlaniEkle('   '), 'boş ad eklenmez');
  esit(app.dizimAlanlariSirali().slice(-1)[0].ad, 'D.C1', 'yeni alan sona eklenir');
  app._temizle();
}
{
  const { app, T, a1 } = planOrtami();
  dogru(app.dizimAlaniAdDegistir(a1, 'D.A1 Üst'), 'ad değiştirilir');
  esit(app.dizimAlaniBul(a1).ad, 'D.A1 Üst', 'yeni ad yazıldı');
  yanlis(app.dizimAlaniAdDegistir(a1, ''), 'boş ada izin verilmez');
  yanlis(app.dizimAlaniAdDegistir('yok', 'X'), 'olmayan alan değiştirilemez');
  app._temizle();
}
{ // Silme: alanın planlardaki girdileri de düşer
  const { app, T, a1, a2 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planAlanGetir(plan, a2);

  dogru(app.dizimAlaniSil(a1), 'alan silinir');
  esit(app.dizimAlaniBul(a1), undefined, 'alan listeden düştü');
  yanlis(plan.alanlar.some(x=>x.alanId===a1), 'plandaki atama da düştü');
  dogru(plan.alanlar.some(x=>x.alanId===a2), 'diğer alan etkilenmedi');
  yanlis(app.dizimAlaniSil('yok'), 'olmayan alan silinemez');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.dizimAlaniPlanSayisi is not a function`.

- [ ] **Step 3: Yönetim fonksiyonlarını yaz**

Task 7'nin sonuna ekle:

```js
/* ---- Dizim alanı yönetimi ----
   Sera yönetiminin sadeleştirilmiş hâli: alan sayısı sahada nadiren değişir. */
function dizimAlaniPlanSayisi(alanId){
  return state.sahaPlanlari.filter(p=>p.alanlar.some(a=>
    a.alanId===alanId && a.bolmeler.some(b=>b.girisler.length || b.seraIds.length)
  )).length;
}
function dizimAlaniEkle(ad){
  const temiz = (ad||'').trim();
  if(!temiz) return false;
  if(state.dizimAlanlari.some(a=>(a.ad||'').toLocaleLowerCase('tr')===temiz.toLocaleLowerCase('tr'))) return false;
  const enBuyukSira = state.dizimAlanlari.reduce((m,a)=>Math.max(m, a.sira||0), 0);
  state.dizimAlanlari.push({ id: uid(), ad: temiz, bolge:'', sira: enBuyukSira+1, olusturma: Date.now(), ...sonIslemDamgasi() });
  return true;
}
function dizimAlaniAdDegistir(alanId, ad){
  const temiz = (ad||'').trim();
  const alan = dizimAlaniBul(alanId);
  if(!alan || !temiz) return false;
  alan.ad = temiz;
  Object.assign(alan, sonIslemDamgasi());
  return true;
}
/* Alan silinince planlardaki atamaları da düşer — yetim alanId bırakmak,
   şemada adsız kutular ve okunamayan geçmiş plan demek. */
function dizimAlaniSil(alanId){
  if(!dizimAlaniBul(alanId)) return false;
  state.dizimAlanlari = state.dizimAlanlari.filter(a=>a.id!==alanId);
  state.sahaPlanlari.forEach(p=>{
    const once = p.alanlar.length;
    p.alanlar = p.alanlar.filter(a=>a.alanId!==alanId);
    if(p.alanlar.length !== once) planDamgala(p);
  });
  return true;
}
function openDizimAlaniYonetimModal(){
  const satirlar = dizimAlanlariSirali().map(a=>{
    const kullanim = dizimAlaniPlanSayisi(a.id);
    return `<div class="dizim-row">
      <div class="dizim-row-main">
        <input value="${escapeHtml(a.ad)}" onchange="dizimAlaniAdDegistir('${a.id}', this.value); renderAll(); openDizimAlaniYonetimModal();">
        <div class="dizim-meta">${kullanim ? kullanim + ' ' + i18n('planda kullanılıyor') : i18n('hiç kullanılmamış')}</div>
      </div>
      <button class="dizim-del" onclick="dizimAlaniSilTikla('${a.id}')" title="${i18n('Sil')}">×</button>
    </div>`;
  }).join('');
  openModal(`
    <h3>${i18n('Dizim Alanları')}</h3>
    <div class="list-small">${satirlar || `<div class="empty-hint">${i18n('Henüz dizim alanı yok.')}</div>`}</div>
    <div class="field"><label>${i18n('Yeni Alan Adı')}</label><input id="yeniDizimAlaniAd" placeholder="D.C1"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">${i18n('Kapat')}</button>
      <button class="btn btn-primary" onclick="submitDizimAlaniEkle()">${i18n('Ekle')}</button>
    </div>`);
}
function submitDizimAlaniEkle(){
  const el = document.getElementById('yeniDizimAlaniAd');
  if(!dizimAlaniEkle(el.value)){ uyar('Alan adı boş olamaz ve aynı ad iki kez kullanılamaz.'); return; }
  renderAll();
  openDizimAlaniYonetimModal();
}
function dizimAlaniSilTikla(alanId){
  const alan = dizimAlaniBul(alanId);
  if(!alan) return;
  const kullanim = dizimAlaniPlanSayisi(alanId);
  const mesaj = kullanim
    ? `${alan.ad} ${kullanim} planda kullanılıyor. Silinirse o planlardaki atamaları da düşer. Silinsin mi?`
    : `${alan.ad} silinsin mi?`;
  if(!onayla(mesaj)) return;
  dizimAlaniSil(alanId);
  renderAll();
  openDizimAlaniYonetimModal();
}
```

- [ ] **Step 4: i18n girdilerini ekle**

```js
  'planda kullanılıyor':'plans use it', 'hiç kullanılmamış':'never used',
  'Henüz dizim alanı yok.':'No stringing areas yet.', 'Yeni Alan Adı':'New Area Name',
  'Alan adı boş olamaz ve aynı ad iki kez kullanılamaz.':'The area name cannot be empty and must be unique.',
```

- [ ] **Step 5: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "dizim alanı yönetim kipi: ekle, adlandır, sil

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Kırım kaydına dönüştürme

**Files:**
- Modify: `scv-saha-v1.html:4834` (`openKirimModal`) ve `:5066` (`submitKirimEkle`)
- Modify: `scv-saha-v1.html` — Task 9'un sonuna
- Test: `tests/run.js` (yeni "Saha Planlama — kırım kaydına dönüştürme" bölümü)

**Interfaces:**
- Consumes: `kirimAkisTarlaId`, `kirimAkisEkTarlaIds`, `kirimAkisSeraSecimleri`, `kirimAdim2Ac`, `submitKirimEkle`
- Produces:
  `planKirimBaglami` (let, `null` | `{tarih, alanId, bolmeId}`),
  `planBolmedenKirimAc(alanId, bolmeId)`,
  `planKirimSonrasiIsaretle(kirimId)` — kayıt oluşunca bölmeye `kirimId` yazar

- [ ] **Step 1: Testleri yaz (kırmızı)**

```js
/* ---------------------------------------------------------------
   Saha Planlama — kırım kaydına dönüştürme
   Plan önce kurulur, kayıt plandan beslenir: aynı bilgi iki kez girilmesin.
   --------------------------------------------------------------- */
bolum('Saha Planlama — kırım kaydına dönüştürme');
{
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planGirisEkle(T, a1, b1, 't1', 'traktor1', 'Ahmet');
  app.planSeraEkle(T, a1, b1, 's0');
  app.planSeraEkle(T, a1, b1, 's1');
  app.planTarihSecildi(T);

  app.planBolmedenKirimAc(a1, b1);
  esit(app.kirimAkisTarlaId, 't0', 'ana tarla plandan geldi');
  esit(app.kirimAkisEkTarlaIds, ['t1'], 'ek tarlalar plandan geldi');
  esit(app.kirimAkisSeraSecimleri.map(x=>x.seraId), ['s0','s1'], 'hedef seralar plandan geldi');
  esit(app.kirimAkisSeraSecimleri[0].mod, 'tam', 'seralar tam mod ile gelir');
  esit(app.planKirimBaglami.bolmeId, b1, 'bağlam bölmeyi hatırlar');
  esit(app._belge.getElementById('k2Tarih').value, T, 'kırım tarihi plan tarihine ayarlanır');
  app._temizle();
}
{ // Kayıt oluşunca bölme işaretlenir ve bağlam temizlenir
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planTarihSecildi(T);
  app.planBolmedenKirimAc(a1, b1);

  app.planKirimSonrasiIsaretle('kayit-1');
  esit(app.planBolmeBul(plan, a1, b1).kirimId, 'kayit-1', 'bölme kayda bağlandı');
  esit(app.planKirimBaglami, null, 'bağlam temizlendi');

  // Bağlam yokken çağrı hiçbir bölmeyi bozmaz
  app.planKirimSonrasiIsaretle('kayit-2');
  esit(app.planBolmeBul(plan, a1, b1).kirimId, 'kayit-1', 'bağlamsız çağrı kaydı değiştirmez');
  app._temizle();
}
{ // Girişsiz bölme dönüştürülemez
  const { app, T, a1 } = planOrtami();
  const plan = app.planGetir(T);
  const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
  app.planTarihSecildi(T);
  app.planBolmedenKirimAc(a1, b1);
  esit(app.planKirimBaglami, null, 'girişsiz bölme akışı başlatmaz');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.planBolmedenKirimAc is not a function`.

- [ ] **Step 3: Dönüştürme fonksiyonlarını yaz**

Task 9'un sonuna ekle:

```js
/* ---- Plandan kırım kaydına ----
   Plan zaten "hangi tarla, hangi sera" sorusunu yanıtlıyor; kırım ekranı da
   aynı iki soruyu soruyor. Bu köprü olmasaydı kullanıcı aynı bilgiyi iki kez
   girerdi. Kullanıcı yalnız dizi/kg ve tarihleri doldurur. */
let planKirimBaglami = null;
function planBolmedenKirimAc(alanId, bolmeId){
  const plan = planBul(planSeciliTarih);
  const bolme = planBolmeBul(plan, alanId, bolmeId);
  if(!bolme) return;
  if(bolme.kirimId){ uyar('Bu bölme zaten bir kırım kaydına dönüştürülmüş.'); return; }
  const tarlaIds = bolme.girisler.map(g=>g.tarlaId).filter(tarlaBul);
  if(!tarlaIds.length){ uyar('Bu bölmede tarla yok — önce bir tarla bağlayın.'); return; }

  planKirimBaglami = { tarih: planSeciliTarih, alanId, bolmeId };
  kirimAkisTarlaId = tarlaIds[0];
  kirimAkisEkTarlaIds = tarlaIds.slice(1);
  kirimAkisSeraSecimleri = bolme.seraIds.filter(seraBul).map(seraId=>({ seraId, mod:'tam' }));
  kirimAdim2Ac();
  const tarihEl = document.getElementById('k2Tarih');
  if(tarihEl) tarihEl.value = planSeciliTarih;
}
function planKirimSonrasiIsaretle(kirimId){
  if(!planKirimBaglami) return;
  const { tarih, alanId, bolmeId } = planKirimBaglami;
  const bolme = planBolmeBul(planBul(tarih), alanId, bolmeId);
  if(bolme){
    bolme.kirimId = kirimId;
    planDamgala(planBul(tarih));
  }
  planKirimBaglami = null;
}
```

- [ ] **Step 4: `submitKirimEkle`'yi bağla**

`scv-saha-v1.html:5117` — `kirimIsaretiniDusur(tarlaIds, k.tarih);` satırının **hemen ardına** ekle:

```js
  planKirimSonrasiIsaretle(k.id); // plandan gelindiyse bölmeyi kayda bağlar (çalışma işareti de böylece düşer)
```

- [ ] **Step 5: Kırım kipi kapanınca bağlamı temizle**

`openKirimModal` (4834) fonksiyonunun ilk satırına ekle — plandan gelmeyen normal bir kırım girişi eski bağlamı miras almamalı:

```js
  planKirimBaglami = null;
```

**Sıra önemli:** `planBolmedenKirimAc` `openKirimModal`'ı değil doğrudan `kirimAdim2Ac`'ı çağırıyor, bu yüzden bağlamı silmez.

- [ ] **Step 6: i18n girdilerini ekle**

```js
  'Bu bölme zaten bir kırım kaydına dönüştürülmüş.':'This section has already been converted to a harvest record.',
  'Bu bölmede tarla yok — önce bir tarla bağlayın.':'No field in this section — connect a field first.',
```

- [ ] **Step 7: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS — Task 4'ün işaret testleri de geçmeye devam etmeli (kayıt girilince işaret düşüyor).

- [ ] **Step 8: Tarayıcıda uçtan uca doğrula**

Bugünün tarihiyle bir plan kur (tarla + sera bağla). Tarlalar panelinde 🔴 KIRIM YAPILIYOR ve Seralar panelinde SERALAR DOLDURULUYOR bantlarının belirdiğini gör. Bölmenin `‹` düğmesiyle kırım kaydını gir. Kayıttan sonra bantların düştüğünü ve bölmede `✓` çıktığını gör.

- [ ] **Step 9: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "plan bölmesinden kırım kaydına dönüştürme köprüsü

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Dünü kopyala

**Files:**
- Modify: `scv-saha-v1.html` — Task 10'un sonuna
- Test: `tests/run.js` (yeni "Saha Planlama — dünü kopyala" bölümü)

**Interfaces:**
- Consumes: `planBul`, `planGetir`, `bosBolme`, `planTarihKaydir`
- Produces:
  `planOncekiDoluTarih(tarih) -> string|null`,
  `planKopyala(kaynakTarih, hedefTarih) -> boolean`,
  `planDunuKopyala()`

- [ ] **Step 1: Testleri yaz (kırmızı)**

```js
/* ---------------------------------------------------------------
   Saha Planlama — dünü kopyala
   Şoför adı KOPYALANMAZ: her gün değişiyor, kopyalanan ad yanlış bilgi olur.
   Araç ataması kopyalanır — filo sabit.
   --------------------------------------------------------------- */
bolum('Saha Planlama — dünü kopyala');
{
  const { app, a1, a2 } = planOrtami();
  const dun = '2026-08-04', bugun = '2026-08-05';
  const kaynak = app.planGetir(dun);
  const b1 = app.planAlanGetir(kaynak, a1).bolmeler[0].id;
  app.planBolmeEkle(dun, a1);
  app.planGirisEkle(dun, a1, b1, 't0', 'traktor1', 'Ahmet');
  app.planSeraEkle(dun, a1, b1, 's0');

  esit(app.planOncekiDoluTarih(bugun), dun, 'önceki dolu gün bulunur');
  dogru(app.planKopyala(dun, bugun), 'plan kopyalanır');

  const hedef = app.planBul(bugun);
  const hb = app.planAlanGetir(hedef, a1);
  esit(hb.bolmeler.length, 2, 'bölme yapısı kopyalandı');
  esit(hb.bolmeler[0].girisler[0].tarlaId, 't0', 'tarla kopyalandı');
  esit(hb.bolmeler[0].girisler[0].aracId, 'traktor1', 'araç kopyalandı');
  esit(hb.bolmeler[0].girisler[0].sofor, '', 'şoför adı kopyalanmadı');
  esit(hb.bolmeler[0].seraIds, ['s0'], 'seralar kopyalandı');
  esit(hb.bolmeler[0].kirimId, null, 'kırım bağı kopyalanmadı');
  yanlis(hb.bolmeler[0].id === b1, 'bölme kimlikleri yenilendi');
  app._temizle();
}
{ // Dolu hedefin üzerine yazılmaz
  const { app, a1 } = planOrtami();
  const dun = '2026-08-04', bugun = '2026-08-05';
  const kaynak = app.planGetir(dun);
  const kb = app.planAlanGetir(kaynak, a1).bolmeler[0].id;
  app.planGirisEkle(dun, a1, kb, 't0', 'traktor1', 'Ahmet');

  const hedef = app.planGetir(bugun);
  const hb = app.planAlanGetir(hedef, a1).bolmeler[0].id;
  app.planGirisEkle(bugun, a1, hb, 't2', 'transit1', 'Veli');

  yanlis(app.planKopyala(dun, bugun), 'dolu hedefe kopyalanmaz');
  esit(app.planBolmeBul(app.planBul(bugun), a1, hb).girisler[0].tarlaId, 't2', 'mevcut plan korundu');
  app._temizle();
}
{ // Kaynak yoksa
  const { app } = planOrtami();
  esit(app.planOncekiDoluTarih('2026-08-05'), null, 'hiç plan yoksa null');
  yanlis(app.planKopyala('2026-08-04', '2026-08-05'), 'olmayan kaynak kopyalanmaz');
  app._temizle();
}
{ // Boşluk atlanır: en son dolu gün bulunur
  const { app, a1 } = planOrtami();
  const eski = '2026-08-01';
  const p = app.planGetir(eski);
  const b = app.planAlanGetir(p, a1).bolmeler[0].id;
  app.planGirisEkle(eski, a1, b, 't0', 'traktor1', 'Ahmet');
  esit(app.planOncekiDoluTarih('2026-08-05'), eski, 'aradaki boş günler atlanır');
  app._temizle();
}
```

- [ ] **Step 2: Testleri çalıştır, kırmızı olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.planOncekiDoluTarih is not a function`.

- [ ] **Step 3: Kopyalamayı yaz**

Task 10'un sonuna ekle:

```js
/* ---- Dünü kopyala ----
   Kırım çoğu gün önceki günün düzeniyle sürer; sıfırdan kurmak angarya.
   "Dün" takvim günü değil, PLANI OLAN en son gün: hafta sonu ya da yağmur
   molası araya girdiğinde de doğru şablon gelir. */
function planOncekiDoluTarih(tarih){
  const adaylar = state.sahaPlanlari
    .filter(p=>(p.tarih||'') < tarih && !planBosMu(p))
    .map(p=>p.tarih)
    .sort();
  return adaylar.length ? adaylar[adaylar.length-1] : null;
}
function planKopyala(kaynakTarih, hedefTarih){
  const kaynak = planBul(kaynakTarih);
  if(!kaynak || planBosMu(kaynak)) return false;
  const mevcut = planBul(hedefTarih);
  if(mevcut && !planBosMu(mevcut)) return false;   // üzerine yazmak veri kaybı olurdu
  const hedef = planGetir(hedefTarih);
  hedef.alanlar = kaynak.alanlar.map(a=>({
    alanId: a.alanId,
    bolmeler: a.bolmeler.map(b=>({
      id: uid(),                                    // kimlikler yenilenir: iki gün aynı bölme id'sini paylaşmamalı
      girisler: b.girisler.map(g=>({ tarlaId:g.tarlaId, aracId:g.aracId, sofor:'' })), // şoför her gün değişir
      seraIds: b.seraIds.slice(),
      kirimId: null,                                // yeni günün kaydı henüz girilmedi
      not: ''
    }))
  }));
  planDamgala(hedef);
  return true;
}
function planDunuKopyala(){
  const kaynak = planOncekiDoluTarih(planSeciliTarih);
  if(!kaynak){ uyar('Kopyalanacak önceki bir plan yok.'); return; }
  if(!planKopyala(kaynak, planSeciliTarih)){
    uyar('Bu günün planı zaten dolu. Kopyalamadan önce mevcut planı boşaltın.');
    return;
  }
  uyar(`${kaynak} planı kopyalandı. Şoför adlarını yeniden girmeyi unutmayın.`);
  renderAll();
}
```

- [ ] **Step 4: i18n girdilerini ekle**

```js
  'Kopyalanacak önceki bir plan yok.':'There is no earlier plan to copy.',
  'Bu günün planı zaten dolu. Kopyalamadan önce mevcut planı boşaltın.':'This day already has a plan. Clear it before copying.',
```

- [ ] **Step 5: Testleri çalıştır, yeşil olduğunu gör**

Run: `node tests/run.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "dünü kopyala: önceki dolu günün planını şablon olarak alır

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Dar ekran kart düzeni ve son doğrulama

**Files:**
- Modify: `scv-saha-v1.html` — Task 5/6 CSS bloğu (medya sorgusu), `I18N_EN` son kontrol
- Test: `tests/run.js` (i18n bütünlük testi)

**Interfaces:**
- Consumes: Task 5–11'in tamamı
- Produces: dar ekran için `@media` kuralları; yeni kullanıcı metinlerinin İngilizce karşılıklarının eksiksizliği

- [ ] **Step 1: i18n bütünlük testini yaz (kırmızı olabilir)**

```js
/* ---------------------------------------------------------------
   Saha Planlama — çeviri bütünlüğü
   Yeni eklenen her kullanıcı metninin İngilizce karşılığı olmalı; eksik
   karşılık İngilizce arayüzde Türkçe metin olarak sızar.
   --------------------------------------------------------------- */
bolum('Saha Planlama — çeviri');
{
  const app = kur();
  const gerekli = [
    'Genel Bilgiler','Saha Planlama','Dizim Alanları','DİZİM','Böl','Birleştir',
    '+ Tarla','tarla yok','araç yok','Kaldır','Kırım Kaydına Dönüştür',
    'Araç','Şoför','Şoför adı','Bağla','Tarla Seç','Uyarı yok.',
    '📋 Dünü Kopyala','⇄ Değiştir','× Seçimi bırak','⚙ Dizim Alanları',
    'Yeni Alan Adı','planda kullanılıyor','hiç kullanılmamış','Henüz dizim alanı yok.',
    'Önceki gün','Sonraki gün'
  ];
  const eksik = gerekli.filter(k => !(k in app.I18N_EN));
  esit(eksik, [], 'tüm yeni metinlerin İngilizce karşılığı var');
  app._temizle();
}
```

- [ ] **Step 2: Testi çalıştır**

Run: `node tests/run.js`
Expected: PASS — Task 5–11'de sözlük girdileri eklendiyse geçer. FAIL alırsan `eksik` listesindeki anahtarları `I18N_EN`'e ekle ve tekrar çalıştır.

- [ ] **Step 3: Dar ekran kurallarını ekle**

Task 5'te açılan `/* ---------- SAHA PLANLAMA ---------- */` bloğunun sonuna ekle. Mevcut dosyada `@media (max-width:900px)` bloğu zaten var (bkz. 1451 ve 1468-1472); üslup tutarlılığı için ayrı bir blok olarak yazılır:

```css
/* Dar ekranda üç sütun yan yana sığmaz: sütunlar alt alta iner ve şema
   "gelen / giden" kart düzenine dönüşür. Çizgiler kapatılır — dikey düzende
   kutuları birleştiren eğriler okunmaz hâle geliyor, gruplama yeterli. */
@media (max-width:900px){
  .plan-sutunlar{grid-template-columns:1fr;gap:var(--sp-2);}
  .plan-cizgi-svg{display:none;}
  .plan-sutun-baslik{position:sticky;top:0;background:var(--surface);padding:var(--sp-1) 0;z-index:1;}
  .plan-sera-grup{padding-left:var(--sp-3);border-left:3px solid var(--border);}
  .plan-sera-grup:empty{display:none;}
}
```

- [ ] **Step 4: Şema başlıklarını dar ekranda anlamlı yap**

`planSemaHtml` içindeki sütun başlıklarını dar ekranda yön belirtecek şekilde güncelle — üç `plan-sutun-baslik` satırını şu hâle getir:

```js
    <div><div class="plan-sutun-baslik">${i18n('Tarlalar')}</div>${tarlaSutun}</div>
    <div><div class="plan-sutun-baslik">${i18n('Dizim Alanları')} ⬅ ${i18n('gelen')}</div>${alanSutun}</div>
    <div><div class="plan-sutun-baslik">${i18n('Seralar')} ➡ ${i18n('giden')}</div>${seraSutun}</div>
```

Ve `I18N_EN`'e ekle:

```js
  'gelen':'incoming', 'giden':'outgoing',
```

- [ ] **Step 5: Tüm testleri çalıştır**

Run: `node tests/run.js`
Expected: PASS — hiçbir bölümde kalan iddia olmamalı.

- [ ] **Step 6: Tarayıcıda uçtan uca doğrula**

Sırayla kontrol et:
1. Saha Krokisi → orta panel → **Saha Planlama** sekmesi → panel tam ekran açılır.
2. `⚙ Dizim Alanları` → 8 alan listelenir, yeni alan eklenir/silinir.
3. `+ Tarla` → tarla seç → bir bölmeye dokun → araç/şoför kipi → bağlanır, çizgi araç renginde çizilir.
4. Bölmeye dokun → seraya dokun → sera bağlanır.
5. `⊞ Böl` → ikinci bölme; farklı çeşitli tarlaları ayrı bölmelere koy → uyarı çıkmaz; aynı bölmeye koy → kırmızı uyarı çıkar.
6. İki tarla seç → `⇄ Değiştir` → takas olur.
7. Tarihi bugüne al → Tarlalar ve Seralar panellerinde çalışma bantları belirir.
8. Bölmenin `‹` düğmesi → kırım kaydı plandan dolu gelir → kaydet → bant düşer, `✓` çıkar.
9. Tarayıcı penceresini 400px genişliğe daralt → sütunlar alt alta iner, çizgiler kaybolur, düzen okunur kalır.
10. Sayfayı yenile → plan Firestore'dan geri gelir (giriş yapılmış olmalı; kurallar publish edilmemişse gelmez).

- [ ] **Step 7: Commit ve push**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "saha planlama dar ekran kart düzeni ve çeviri bütünlüğü

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 8: Canlı doğrulama ve kural hatırlatması**

Push sonrası GitHub Pages sürümünde (bkz. `MEMORY.md` → SCV repo/live links) Saha Planlama sekmesini aç ve bir plan kur. Plan kaydolmuyorsa `firestore.rules` publish edilmemiş demektir — kullanıcıya **Firebase Console > Firestore > Rules > Publish** adımını hatırlat.

---

## Self-Review

**Spec coverage:**

| Şartname bölümü | Task |
| --- | --- |
| `dizimAlanlari` koleksiyonu, D. öneki, tohumlama | 1 |
| Alan yönetimi (ekle/adlandır/sil, kullanım sayısı) | 9 |
| `sahaPlanlari` koleksiyonu, tembel belge | 1 |
| Bölme 1–4, çeşit türetilir, sera tekil sahiplik | 2, 3 |
| Araçlar kodda sabit, şoför serbest metin + öneri | 1, 7 |
| Firestore kuralları + manuel publish | 1 (Step 4, Step 10), 12 (Step 8) |
| Sekmeler + tam ekran yerleşimi | 5 |
| Üç sütun şema, sera doluluk çubuğu | 6 |
| Bağlantı çizgileri, araç rengi, şoför etiketi | 8 |
| Seçim / bağlama / takas / kaldırma | 7 |
| Böl / Birleştir düğmeleri | 7 |
| Karışma uyarısı (engellemez), boş alan listesi | 3, 6 |
| Dünü Kopyala (şoför hariç) | 11 |
| Çalışma işareti türetimi | 4 |
| Kırım kaydına dönüştürme | 10 |
| Dar ekran kart düzeni | 12 |
| Test listesi (şartname 6 madde) | 2 (madde 1,2,5), 3 (madde 3), 4 (madde 4), 11 (madde 6) |

Kapsam dışı bırakılanlar (şartnameye uygun): serbest tuval, kg/dizi tahmini, rol/izin, Ödemeler/Depo değişikliği, sezon özel işi.

**Tip tutarlılığı:** `planBolmeBul(plan, alanId, bolmeId)` imzası Task 2'de tanımlanıp 3, 4, 7, 10, 11'de aynı sırayla kullanılıyor. `planSecim` nesnesi `{tur, id, alanId, bolmeId}` biçiminde Task 6'da okunup Task 7'de yazılıyor. `bosBolme()` alanları (`id, girisler, seraIds, kirimId, not`) Task 1'de tanımlanıp Task 11'deki kopyalamada birebir üretiliyor.

**Bilinen ödünç:** Task 6, Task 7'de gerçeğiyle değiştirilen geçici bir `planSecim` saplaması ekliyor. Bu bilinçli — şema render'ı seçim mantığından önce test edilebilsin diye; Task 7 Step 3 saplamayı açıkça değiştiriyor.

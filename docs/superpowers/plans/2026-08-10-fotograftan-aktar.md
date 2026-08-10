# Fotoğraftan Aktar — Uygulama Planı

> **Ajanlara:** Bu plan ana oturumda sırayla uygulanır (`CLAUDE.md`: alt ajan çağırma).
> Adımlar takip için onay kutusu (`- [ ]`) kullanır.

**Hedef:** Sahadaki iki kâğıdı telefonla fotoğraflayıp, uygulamanın kırım kaydı açmasını, seraları doldurmasını ve önceki dönemi kapatmasını sağlamak — kayıt açma yetkisi her zaman kullanıcının onayında kalarak.

**Mimari:** Yeni bir kayıt yolu **açılmıyor**. `gecmisKirimDepoVerisiAktar()` içindeki satır uygulama çekirdeği `kirimSatiriUygula()` olarak ayrıştırılıyor ve fotoğraf yolu da, mevcut geçmiş import da aynı çekirdeği çağırıyor. Fotoğraf yalnızca "satır listesi" üretiyor; aradaki bütün akıl saf bir denetim fonksiyonunda ve bir onay ekranında.

**Teknoloji:** Tek dosya HTML/CSS/JS (`scv-saha-v1.html`), Firebase senkron, Claude Messages API (`claude-opus-5`), Node test harness (`tests/run.js`).

**Şartname:** `docs/superpowers/specs/2026-08-10-fotograftan-aktar-design.md`

## Global Kısıtlar

Her görevin gereklerine bunlar örtük olarak dâhildir:

- **API anahtarı `state` içine ASLA yazılmaz.** `state` Firestore'a senkronlanıp yedeğe giriyor (`:3181`, `:8133`). Anahtar yalnızca `localStorage`'da, `scvYzAnahtar` altında durur.
- **Fotoğraf hiçbir koşulda doğrudan kayıt açmaz.** Her yol onay ekranından geçer.
- Model kimliği tam olarak `claude-opus-5`. Tarih eki yok.
- Görüntü uzun kenarı **2576 piksel** — küçültme hedefi değil isabet hedefi. Daha küçüğe indirmek sera kodlarını ayırt eden pikselleri atar.
- `max_tokens` ≥ 8000. Opus 5'te düşünme varsayılan açık ve `max_tokens` düşünme + metni birlikte sınırlar.
- Kırım tarihi ve dizim tarihi **ayrı alanlardır**, hiçbir sadeleştirme gerekçesiyle birleştirilmez.
- Sürüm elle değiştirilmez — pre-commit hook `APP_SURUM` + `CACHE_NAME` artırır.
- Her görev sonunda `node tests/run.js` çalıştırılır (şu an **434 geçiyor**, 0 kalan). Sayı düşerse görev bitmemiştir.
- Yeni `const`/`let` sabitleri teste görünmez; teste lazımsa `tests/harness.js` içindeki `disaAktarmaEki` bloğuna (`:336`) eklenir. `function` ile tanımlananlar otomatik görünür.

## Dosya Haritası

| Dosya | Sorumluluk | Görevler |
| --- | --- | --- |
| `scv-saha-v1.html` | Tüm uygulama kodu (tek dosya, mevcut düzen korunur) | 1–9 |
| `tests/harness.js` | `fetch` enjeksiyonu (şu an sabit reddediyor, `:300`) | 6 |
| `tests/run.js` | Yeni bölümler: denetim, eşleme, anahtar, çağrı | 1–9 |
| `sw.js` | `api.anthropic.com` by-pass | 6 |
| `firestore.rules` | `cesitKodEslemesi` koleksiyonu | 4 |

`scv-saha-v1.html` içinde yeni kod, geçmiş import bloğunun (`:7285`–`:7500`) hemen ardına, kendi başlıklı bölümü olarak yazılır.

---

### Görev 1: Sera paylarını çözme

Sera adları listesini gerçek sera kayıtlarına ve dizi sayılarına çeviren saf fonksiyon. Sonraki her şey buna dayanıyor.

**Dosyalar:**
- Değiştir: `scv-saha-v1.html` (geçmiş import bloğunun sonuna, `:7500` civarı)
- Test: `tests/run.js`

**Arayüzler:**
- Kullandığı: `state.seralar` (`{id, ad, kapasite}`)
- Ürettiği: `fotoSeraPaylariCoz(adlar, state)` → `[{ad, seraId|null, dizi, yarim}]`

`*` soneki yarım sera demek — mevcut `gecmisImportSeraAyristir` kuralının aynısı (`:7380`). Farkı: dizi sayısı sabit 400 değil, **seranın kendi kapasitesi**. Kâğıttaki `(YARIM)` işaretini `*`'a modelin kendisi çevirir (Görev 6).

- [ ] **Adım 1: Başarısız testi yaz**

`tests/run.js` sonuna:

```js
bolum('Fotoğraftan aktar — sera payları');
{
  const app = kur();
  app.state.seralar.push(
    { id:'s1', ad:'D19', kapasite:400, bolge:'kalemli', donemler:[] },
    { id:'s2', ad:'80 cm', kapasite:200, bolge:'kalemli', donemler:[] }
  );

  const paylar = app.fotoSeraPaylariCoz(['D19', 'D19*', '80 cm', 'YOKBOYLE'], app.state);
  esit(paylar[0], { ad:'D19', seraId:'s1', dizi:400, yarim:false }, 'tam sera kendi kapasitesini alır');
  esit(paylar[1], { ad:'D19', seraId:'s1', dizi:200, yarim:true }, 'yıldızlı sera yarım dolar');
  esit(paylar[2], { ad:'80 cm', seraId:'s2', dizi:200, yarim:false }, 'kapasite 400 varsayılmaz, seradan okunur');
  esit(paylar[3], { ad:'YOKBOYLE', seraId:null, dizi:0, yarim:false }, 'bilinmeyen sera seraId=null döner');
  app._temizle();
}
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`
Beklenen: `fotoSeraPaylariCoz is not a function` ile KALAN.

- [ ] **Adım 3: Fonksiyonu yaz**

```js
/* =========================================================
   FOTOĞRAFTAN AKTAR
   Kâğıt tabloyu/defteri okuyup mevcut aktarım borusuna satır üretir.
   Buradaki fonksiyonların tamamı SAF: DOM'a dokunmaz, ağa çıkmaz.
   ========================================================= */

/* Sera adı listesini gerçek sera kayıtlarına bağlar.
   '*' soneki = yarım sera (geçmiş import'taki kuralın aynısı). Dizi sayısı
   sabit 400 DEĞİL, seranın kendi kapasitesi: kâğıtta "80 cm" gibi düşük
   kapasiteli seralar var ve 400 varsaymak onları iki katı dolu gösterirdi. */
function fotoSeraPaylariCoz(adlar, st){
  return (adlar||[]).map(ham=>{
    const metin = String(ham||'').trim();
    const yarim = metin.endsWith('*');
    const ad = (yarim ? metin.slice(0,-1) : metin).trim();
    const sera = st.seralar.find(s=>(s.ad||'').trim().toUpperCase()===ad.toUpperCase());
    if(!sera) return { ad, seraId:null, dizi:0, yarim:false };
    const kapasite = Number(sera.kapasite)||0;
    return { ad, seraId: sera.id, dizi: yarim ? Math.round(kapasite/2) : kapasite, yarim };
  });
}
```

- [ ] **Adım 4: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 438, KALAN 0.

- [ ] **Adım 5: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "fotoğraftan aktar: sera payları seranın kendi kapasitesinden çözülür"
```

---

### Görev 2: Tablo satırı denetimi

Şartnamedeki tablo kurallarının tamamı. Testlerin ağırlığı burada.

**Dosyalar:**
- Değiştir: `scv-saha-v1.html` (Görev 1'in altına)
- Test: `tests/run.js`

**Arayüzler:**
- Kullandığı: `fotoSeraPaylariCoz` (Görev 1), `state.seralar`, `state.kirimlar`
- Ürettiği: `fotoTabloDenetle(satirlar, st)` → `[{satir, durum, bayraklar, paylar}]`
  - `durum`: `'yesil'|'sari'|'gri'|'kirmizi'`
  - `bayraklar`: `[{tip, mesaj}]`
  - `paylar`: Görev 1 çıktısı, gri seralar ayıklanmış hâlde

Satır şekli (modelden gelen):
```js
{ no:1, tohumKodu:'kod:3', yetistirme:'yerOcagi', kirim:'2026-07-24', dizim:'2026-07-26', seralar:['D24','D30'], soldurmaGun:2 }
```

- [ ] **Adım 1: Başarısız testi yaz**

```js
bolum('Fotoğraftan aktar — tablo denetimi');
{
  const app = kur();
  app.state.seralar.push(
    { id:'s1', ad:'D24', kapasite:400, bolge:'kalemli', donemler:[] },
    { id:'s2', ad:'D25', kapasite:400, bolge:'kalemli', donemler:[] }
  );
  const tabanSatir = { no:1, tohumKodu:'kod:3', yetistirme:'yerOcagi', kirim:'2026-07-24', dizim:'2026-07-26', seralar:['D24','D25'], soldurmaGun:2 };

  // Temiz satır
  let r = app.fotoTabloDenetle([tabanSatir], app.state)[0];
  esit(r.durum, 'yesil', 'her şeyi tutan satır yeşil');
  esit(r.bayraklar.length, 0, 'temiz satırda bayrak yok');

  // Bilinmeyen sera → kırmızı
  r = app.fotoTabloDenetle([{ ...tabanSatir, seralar:['D24','YOKBOYLE'] }], app.state)[0];
  esit(r.durum, 'kirmizi', 'bilinmeyen sera satırı kırmızı yapar');
  dogru(r.bayraklar.some(b=>b.tip==='seraYok'), 'seraYok bayrağı düşer');

  // Soldurma sağlaması tutmuyor → sarı
  r = app.fotoTabloDenetle([{ ...tabanSatir, soldurmaGun:5 }], app.state)[0];
  esit(r.durum, 'sari', 'soldurma ile tarih farkı çelişirse sarı');
  dogru(r.bayraklar.some(b=>b.tip==='soldurmaCelisik'), 'soldurmaCelisik bayrağı düşer');

  // Dizim kırımdan önce → sarı
  r = app.fotoTabloDenetle([{ ...tabanSatir, dizim:'2026-07-22', soldurmaGun:-2 }], app.state)[0];
  dogru(r.bayraklar.some(b=>b.tip==='dizimGeride'), 'dizim kırımdan önceyse bayrak düşer');

  // Aynı satırda tekrar eden sera → sarı
  r = app.fotoTabloDenetle([{ ...tabanSatir, seralar:['D24','D24'] }], app.state)[0];
  dogru(r.bayraklar.some(b=>b.tip==='seraTekrar'), 'aynı satırda tekrar eden sera işaretlenir');

  // Tamamı zaten kayıtlı → gri
  app.state.kirimlar.push({
    id:'k1', tarih:'2026-07-24', seraDagilimi:[
      { id:'d1', seraId:'s1', diziSayisi:400, dizimTarihi:'2026-07-26' },
      { id:'d2', seraId:'s2', diziSayisi:400, dizimTarihi:'2026-07-26' }
    ]
  });
  r = app.fotoTabloDenetle([tabanSatir], app.state)[0];
  esit(r.durum, 'gri', 'kümenin tamamı kayıtlıysa satır atlanır');

  // Kısmen kayıtlı → sarı, yalnızca yeni sera uygulanır
  app.state.seralar.push({ id:'s3', ad:'D26', kapasite:400, bolge:'kalemli', donemler:[] });
  r = app.fotoTabloDenetle([{ ...tabanSatir, seralar:['D24','D25','D26'] }], app.state)[0];
  esit(r.durum, 'sari', 'kısmi eşleşme gri değil sarı');
  esit(r.paylar.map(p=>p.ad), ['D26'], 'yalnızca kayıtsız sera uygulanır');
  dogru(r.bayraklar.some(b=>b.tip==='kismenKayitli'), 'kismenKayitli bayrağı düşer');

  app._temizle();
}
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`
Beklenen: `fotoTabloDenetle is not a function`.

- [ ] **Adım 3: Fonksiyonu yaz**

```js
/* İki tarih arasındaki tam gün farkı. Saat 12:00 sabitlenir — yaz saati
   geçişinde 23/25 saatlik günler tam sayıya yuvarlanırken 1 gün kayabiliyor. */
function fotoGunFarki(a, b){
  const t1 = new Date(a+'T12:00:00').getTime(), t2 = new Date(b+'T12:00:00').getTime();
  if(!isFinite(t1) || !isFinite(t2)) return null;
  return Math.round((t2-t1)/86400000);
}

/* Bu sera, bu kırım+dizim tarihiyle zaten kayıtlı mı?
   Kâğıt birikimli: her fotoğrafta eski satırlar da duruyor. Bu kontrol
   olmadan her aktarım aynı dizimleri ikinci kez yazardı. */
function fotoDizimKayitliMi(st, seraId, kirimTarihi, dizimTarihi){
  return st.kirimlar.some(k=> k.tarih===kirimTarihi &&
    (k.seraDagilimi||[]).some(d=> d.seraId===seraId && (d.dizimTarihi||k.tarih)===dizimTarihi));
}

/* Tablo satırlarını denetler. Hiçbir şeyi uygulamaz, yalnızca bayrak üretir.
   Durum sırası: kirmizi > gri > sari > yesil (en kötü olan kazanır). */
function fotoTabloDenetle(satirlar, st){
  return (satirlar||[]).map(satir=>{
    const bayraklar = [];
    const paylar = fotoSeraPaylariCoz(satir.seralar, st);

    paylar.filter(p=>!p.seraId).forEach(p=>{
      bayraklar.push({ tip:'seraYok', mesaj:'Sera bulunamadı: ' + p.ad });
    });

    const gorulen = new Set();
    paylar.forEach(p=>{
      const anahtar = p.ad.toUpperCase();
      if(gorulen.has(anahtar)) bayraklar.push({ tip:'seraTekrar', mesaj:'Sera iki kez yazılmış: ' + p.ad });
      gorulen.add(anahtar);
    });

    const fark = fotoGunFarki(satir.kirim, satir.dizim);
    if(fark != null && fark < 0){
      bayraklar.push({ tip:'dizimGeride', mesaj:'Dizim tarihi kırımdan önce' });
    }
    if(fark != null && satir.soldurmaGun != null && Number(satir.soldurmaGun) !== fark){
      bayraklar.push({ tip:'soldurmaCelisik',
        mesaj:'Soldurma ' + satir.soldurmaGun + ' gün yazılmış ama tarihler ' + fark + ' gün gösteriyor' });
    }

    /* Kayıtlı/kayıtsız ayrımı: tamamı kayıtlıysa satır atlanır, bir kısmı
       kayıtlıysa yalnızca yenisi uygulanır. Tamamını yeni saymak mevcut
       dizimi ikinci kez yazar, tamamını atlamak yeni serayı sessizce düşürür. */
    const bilinen = paylar.filter(p=>p.seraId);
    const kayitli = bilinen.filter(p=>fotoDizimKayitliMi(st, p.seraId, satir.kirim, satir.dizim));
    const uygulanacak = paylar.filter(p=>p.seraId && !kayitli.includes(p));
    if(bilinen.length && kayitli.length === bilinen.length){
      return { satir, durum:'gri', bayraklar:[{ tip:'zatenKayitli', mesaj:'Bu satır zaten aktarılmış' }], paylar:[] };
    }
    if(kayitli.length){
      bayraklar.push({ tip:'kismenKayitli',
        mesaj:'Zaten kayıtlı, atlanacak: ' + kayitli.map(p=>p.ad).join(', ') });
    }

    const durum = bayraklar.some(b=>b.tip==='seraYok') ? 'kirmizi'
                : bayraklar.length ? 'sari' : 'yesil';
    return { satir, durum, bayraklar, paylar: uygulanacak };
  });
}
```

- [ ] **Adım 4: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 450, KALAN 0.

- [ ] **Adım 5: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "fotoğraftan aktar: tablo satırı denetimi (soldurma sağlaması, kısmi eşleşme)"
```

---

### Görev 3: Defter satırı denetimi ve tarla önerisi

Ölçümde yakalanan hata sınıfının karşılığı: üç bağımsız sağlama, ve üçü de başka bir tarlaya uyuyorsa düzeltme önerisi.

**Dosyalar:**
- Değiştir: `scv-saha-v1.html` (Görev 2'nin altına)
- Test: `tests/run.js`

**Arayüzler:**
- Kullandığı: `state.tarlalar` (`{id, ad, dekar, cesit, viyolDekar, yerOcagiDekar}`)
- Ürettiği:
  - `fotoDefterDenetle(satirlar, st)` → `[{satir, durum, bayraklar, tarlaId, oneri}]`
  - `fotoTarlaEsle(tabloSatiri, defterSonuclari)` → `{tarlaIds, kirimNo}` — tablo satırının tarla bağını defterden kurar

Satır şekli: `{ no:1, tarlaKodu:'K21', dekar:52, tarih:'2026-07-15', cesit:'PVH 2310', yetistirme:'yerOcagi', kirimNo:2 }`

`yetistirme` değerleri: `'viyol'`, `'yerOcagi'`, `'karma'`.

- [ ] **Adım 1: Başarısız testi yaz**

```js
bolum('Fotoğraftan aktar — defter denetimi');
{
  const app = kur();
  app.state.tarlalar.push(
    { id:'t18', ad:'K18', dekar:17, cesit:'PVH 2310', viyolDekar:0,  yerOcagiDekar:17, bolge:'kalemli' },
    { id:'t19', ad:'K19', dekar:18, cesit:'ITB 6179', viyolDekar:18, yerOcagiDekar:0,  bolge:'kalemli' },
    { id:'t21', ad:'K21', dekar:51, cesit:'PVH 2310', viyolDekar:21, yerOcagiDekar:30, bolge:'kalemli' }
  );

  // Üçü de tutan satır
  let r = app.fotoDefterDenetle([{ no:1, tarlaKodu:'K18', dekar:17, tarih:'2026-07-20', cesit:'PVH 2310', yetistirme:'yerOcagi', kirimNo:1 }], app.state)[0];
  esit(r.durum, 'yesil', 'dekar+çeşit+yöntem tutan satır yeşil');
  esit(r.tarlaId, 't18', 'tarla koddan bulunur');

  // Ölçümde yakalanan gerçek hata: K19 satırı K18 diye okunmuş
  r = app.fotoDefterDenetle([{ no:2, tarlaKodu:'K18', dekar:18, tarih:'2026-07-20', cesit:'ITB 6179', yetistirme:'viyol', kirimNo:1 }], app.state)[0];
  esit(r.durum, 'sari', 'üç sağlama birden patlayınca sarı');
  esit(r.oneri, 'K19', 'tarif başka tarlaya tam uyuyorsa düzeltme önerilir');

  // Yalnızca dekar 1 kayıyor (K21 52/51) — öneri YOK, çünkü başka tarlaya uymuyor
  r = app.fotoDefterDenetle([{ no:3, tarlaKodu:'K21', dekar:52, tarih:'2026-07-15', cesit:'PVH 2310', yetistirme:'karma', kirimNo:2 }], app.state)[0];
  esit(r.durum, 'sari', 'dekar tutmayınca sarı');
  esit(r.oneri, null, 'tek alan kayıyorsa başka tarla önerilmez');
  dogru(r.bayraklar.some(b=>b.tip==='dekarCelisik'), 'dekarCelisik bayrağı düşer');

  // Tarla hiç yok
  r = app.fotoDefterDenetle([{ no:4, tarlaKodu:'K99', dekar:10, tarih:'2026-07-20', cesit:'PVH 2310', yetistirme:'viyol', kirimNo:1 }], app.state)[0];
  esit(r.durum, 'kirmizi', 'bilinmeyen tarla kodu kırmızı');
  esit(r.tarlaId, null, 'bulunamayan tarlanın id\'si null');

  app._temizle();
}
{
  // Defter satırları tablo satırına tarla bağını verir (ayrı kayıt olarak YAZILMAZ)
  const app = kur();
  app.state.tarlalar.push(
    { id:'t19', ad:'K19', dekar:18, cesit:'ITB 6179', viyolDekar:18, yerOcagiDekar:0, bolge:'kalemli' },
    { id:'t25', ad:'K25', dekar:75, cesit:'PVH 2310', viyolDekar:0, yerOcagiDekar:75, bolge:'kalemli' }
  );
  const defter = app.fotoDefterDenetle([
    { no:1, tarlaKodu:'K19', dekar:18, tarih:'2026-07-20', cesit:'ITB 6179', yetistirme:'viyol', kirimNo:2 },
    { no:2, tarlaKodu:'K25', dekar:75, tarih:'2026-07-20', cesit:'PVH 2310', yetistirme:'yerOcagi', kirimNo:2 }
  ], app.state);

  // Aynı gün kırılan iki tarla TEK kayda bağlanır — dekar oranlı bölme yasak
  let e = app.fotoTarlaEsle({ kirim:'2026-07-20' }, defter);
  esit(e.tarlaIds, ['t19','t25'], 'aynı gün kırılan tarlaların hepsi tek kayda bağlanır');
  esit(e.kirimNo, 2, 'hepsi aynı numaradaysa numara yazılır');

  // Karışık numara → null (yanıltıcı numara basılmaz)
  const karisik = app.fotoDefterDenetle([
    { no:1, tarlaKodu:'K19', dekar:18, tarih:'2026-07-20', cesit:'ITB 6179', yetistirme:'viyol', kirimNo:1 },
    { no:2, tarlaKodu:'K25', dekar:75, tarih:'2026-07-20', cesit:'PVH 2310', yetistirme:'yerOcagi', kirimNo:2 }
  ], app.state);
  esit(app.fotoTarlaEsle({ kirim:'2026-07-20' }, karisik).kirimNo, null, 'karışık numarada numara boş bırakılır');

  // Eşleşme yoksa tarlasız kayıt (mevcut kod bunu zaten destekliyor)
  e = app.fotoTarlaEsle({ kirim:'2026-08-01' }, defter);
  esit(e.tarlaIds, [], 'eşleşmeyen tarihte tarlasız kayıt açılır');
  app._temizle();
}
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`
Beklenen: `fotoDefterDenetle is not a function`.

- [ ] **Adım 3: Fonksiyonu yaz**

```js
/* Tarlanın fide yöntemi dekar alanlarından türer — mevcut fideTipi() ile
   aynı mantık, ama burada state'ten bağımsız saf karşılaştırma gerekiyor. */
function fotoTarlaYontemi(tarla){
  const v = Number(tarla.viyolDekar)||0, y = Number(tarla.yerOcagiDekar)||0;
  if(v>0 && y>0) return 'karma';
  if(v>0) return 'viyol';
  if(y>0) return 'yerOcagi';
  return null;
}

/* Çeşit alanı tarlada "PVH 2310, BSB 6202" gibi çoklu olabiliyor; kâğıt tek
   çeşit yazıyor. Bu yüzden eşitlik değil "içeriyor mu" sorulur. */
function fotoCesitUyuyorMu(tarlaCesidi, kagitCesidi){
  if(!tarlaCesidi || !kagitCesidi) return true; // bilgi yoksa çelişki de yok
  return String(tarlaCesidi).toUpperCase().includes(String(kagitCesidi).toUpperCase());
}

/* Bir defter satırının tarifi (dekar + çeşit + yöntem) bu tarlaya tam uyuyor mu? */
function fotoTarlaTamUyuyorMu(tarla, satir){
  return Number(tarla.dekar) === Number(satir.dekar)
      && fotoCesitUyuyorMu(tarla.cesit, satir.cesit)
      && fotoTarlaYontemi(tarla) === satir.yetistirme;
}

/* Defter satırlarını denetler. Bu kâğıtta her satırın ÜÇ bağımsız sağlaması
   var (dekar, çeşit, viyol/yer ocağı) — üçünün aynı anda yanlış hizalanması
   pratikte imkânsız. Üçü birden tutmuyorsa ve tarif başka bir tarlaya tam
   uyuyorsa, sistem hatayı bulmakla kalmaz doğrusunu da söyleyebilir. */
function fotoDefterDenetle(satirlar, st){
  return (satirlar||[]).map(satir=>{
    const bayraklar = [];
    const kod = String(satir.tarlaKodu||'').toUpperCase();
    const tarla = st.tarlalar.find(t=>(t.ad||'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).includes(kod));

    if(!tarla){
      return { satir, durum:'kirmizi', tarlaId:null, oneri:null,
        bayraklar:[{ tip:'tarlaYok', mesaj:'Tarla bulunamadı: ' + satir.tarlaKodu }] };
    }

    if(satir.dekar != null && Number(tarla.dekar) !== Number(satir.dekar)){
      bayraklar.push({ tip:'dekarCelisik',
        mesaj:'Kâğıtta ' + satir.dekar + ' da, kayıtta ' + tarla.dekar + ' da' });
    }
    if(!fotoCesitUyuyorMu(tarla.cesit, satir.cesit)){
      bayraklar.push({ tip:'cesitCelisik',
        mesaj:'Kâğıtta ' + satir.cesit + ', kayıtta ' + tarla.cesit });
    }
    const yontem = fotoTarlaYontemi(tarla);
    if(satir.yetistirme && yontem && yontem !== satir.yetistirme){
      bayraklar.push({ tip:'yontemCelisik',
        mesaj:'Kâğıtta ' + satir.yetistirme + ', kayıtta ' + yontem });
    }

    /* Üç sağlama birden patladıysa okuma büyük ihtimalle yanlış tarlayı
       gösteriyor. Tarif tek bir başka tarlaya tam uyuyorsa onu öner —
       birden fazlasına uyuyorsa öneri yapma, tahmine dönüşür. */
    let oneri = null;
    if(bayraklar.length >= 3){
      const uyanlar = st.tarlalar.filter(t=>fotoTarlaTamUyuyorMu(t, satir));
      if(uyanlar.length === 1) oneri = uyanlar[0].ad;
    }

    return { satir, durum: bayraklar.length ? 'sari' : 'yesil',
      tarlaId: tarla.id, oneri, bayraklar };
  });
}

/* Tablo satırının tarla bağını defterden kurar. Tablo kâğıdı tarlayı hiç
   içermiyor; bağ SADECE kırım tarihinin eşleşmesinden geliyor — geçmiş
   import'taki mantığın aynısı (:7419).
   Aynı gün kırılan tarlaların HEPSİ tek kayda bağlanır, kayıt bölünmez:
   ortak kırımda pay dekara göre değil toplamda eşit paylaşılıyor.
   Numaralar karışıksa (kimine 1. kimine 2. kırım) numara boş bırakılır —
   yanıltıcı numara basmaktansa hiç basmamak doğru. */
function fotoTarlaEsle(tabloSatiri, defterSonuclari){
  const esler = (defterSonuclari||[]).filter(d=>d.tarlaId && d.satir.tarih === tabloSatiri.kirim);
  const tarlaIds = esler.map(d=>d.tarlaId);
  const nolar = [...new Set(esler.map(d=>d.satir.kirimNo).filter(n=>n!=null))];
  return { tarlaIds, kirimNo: (tarlaIds.length && nolar.length===1) ? nolar[0] : null };
}
```

- [ ] **Adım 4: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 464, KALAN 0.

- [ ] **Adım 5: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "fotoğraftan aktar: defter denetimi — üç sağlama ve tarla düzeltme önerisi"
```

---

### Görev 4: `kirimSatiriUygula` ayrıştırması

Mevcut import mantığını fonksiyona çıkar. Davranış **değişmiyor**; mevcut testler regresyon koruması.

**Dosyalar:**
- Değiştir: `scv-saha-v1.html:7409-7469` (`GECMIS_KIRIM_SATIRLARI.forEach` gövdesi)
- Test: `tests/run.js`

**Arayüzler:**
- Kullandığı: `dizimUygula` (`:6849`), `seraAktifDonem`, `uid`, `sonIslemDamgasi`
- Ürettiği: `kirimSatiriUygula(satir, oturum)` → `{kirim, dolanSera, kapatilanDonem}`
  - `satir`: `{kirim, dizim, cesit, ortDiziKg, soldurmaGun, kirimNo, tarlaIds, paylar}` — `paylar` Görev 1 çıktısı
  - `oturum`: `{seraSonDolduran: {}}` — aktarım boyunca taşınan, seranın bu oturumda daha önce dolup dolmadığını tutan defter

Ayrıştırmanın tek amacı **mantığın kopyalanmaması**: fotoğraf yolu ile geçmiş import aynı çekirdeği çağırmazsa ikisi zamanla ayrışır.

- [ ] **Adım 1: Çekirdeğin davranışını sabitleyen testi yaz**

```js
bolum('Fotoğraftan aktar — satır uygulama çekirdeği');
{
  const app = kur();
  app.state.seralar.push({ id:'s1', ad:'A1', kapasite:400, bolge:'kalemli', donemler:[] });
  const oturum = { seraSonDolduran: {} };

  const ilk = app.kirimSatiriUygula({
    kirim:'2026-06-29', dizim:'2026-07-01', cesit:'PVH 2310', ortDiziKg:3.5,
    soldurmaGun:2, kirimNo:1, tarlaIds:[],
    paylar:[{ ad:'A1', seraId:'s1', dizi:400, yarim:false }]
  }, oturum);

  esit(app.state.kirimlar.length, 1, 'kırım kaydı açılır');
  esit(ilk.kirim.tarih, '2026-06-29', 'kırım tarihi yazılır');
  esit(ilk.kirim.diziSayisi, 400, 'dizi toplamı paylardan hesaplanır');
  esit(ilk.kirim.seraDagilimi[0].dizimTarihi, '2026-07-01', 'dizim tarihi AYRI alan olarak korunur');
  esit(ilk.kapatilanDonem, 0, 'ilk dolumda kapatılan dönem yok');
  dogru(app.state.seralar[0].donemler.some(d=>d.aktif), 'sera aktif dönemle dolar');

  // 2. tur: aynı sera yeniden dolarsa önceki dönem kapanır
  const ikinci = app.kirimSatiriUygula({
    kirim:'2026-07-16', dizim:'2026-07-19', cesit:'PVH 2310', ortDiziKg:3.6,
    soldurmaGun:3, kirimNo:2, tarlaIds:[],
    paylar:[{ ad:'A1', seraId:'s1', dizi:400, yarim:false }]
  }, oturum);

  esit(ikinci.kapatilanDonem, 1, '2. turda önceki dönem kapatılır');
  esit(app.state.seralar[0].donemler.filter(d=>d.aktif).length, 1, 'tek aktif dönem kalır');
  app._temizle();
}
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`
Beklenen: `kirimSatiriUygula is not a function`.

- [ ] **Adım 3: Fonksiyonu yaz** (Görev 3'ün altına)

```js
/* Bir satırı (kırım + dizim + sera payları) state'e uygular.
   Hem geçmiş import hem fotoğraf yolu BURAYI çağırır — mantık iki yere
   kopyalanırsa zamanla ayrışır ve biri sessizce yanlış davranmaya başlar.
   `oturum.seraSonDolduran` aktarım boyunca taşınır: aynı sera bu aktarımda
   daha önce dolduysa 2. tur demektir, önceki dönem kapatılır. */
function kirimSatiriUygula(satir, oturum){
  const paylar = (satir.paylar||[]).filter(p=>p.seraId);
  const toplamDizi = paylar.reduce((s,p)=>s+p.dizi, 0);

  const k = {
    id: uid(),
    tarih: satir.kirim,                       // KIRIM (hasat) tarihi
    tarlaId: (satir.tarlaIds||[]).length===1 ? satir.tarlaIds[0] : null,
    tarlaIds: satir.tarlaIds||[],
    cesit: satir.cesit || '',
    kirimNo: satir.kirimNo != null ? satir.kirimNo : null,
    diziSayisi: toplamDizi,
    ortDiziKg: satir.ortDiziKg || 0,
    seraDagilimi: [],
    isciSayisi: 0, yevmiye: 0, kayipDizi: 0, altYasYok: false, calismaSaati: 0,
    soldurmaGunSayisi: satir.soldurmaGun != null ? satir.soldurmaGun : null,
    olusturma: Date.now(),
    ...sonIslemDamgasi()
  };
  state.kirimlar.push(k);

  let kapatilanDonem = 0, dolanSera = 0;
  paylar.forEach(p=>{
    const sera = state.seralar.find(s=>s.id===p.seraId);
    if(!sera) return;
    if(oturum.seraSonDolduran[sera.id] != null && oturum.seraSonDolduran[sera.id] !== satir.kirim){
      const d = seraAktifDonem(sera);
      if(d){ d.aktif = false; d.bitis = new Date(satir.dizim+'T12:00:00').getTime(); kapatilanDonem++; }
    }
    dizimUygula(k, sera.id, p.dizi, satir.dizim);  // DİZİM tarihi ayrı alan
    oturum.seraSonDolduran[sera.id] = satir.kirim;
    dolanSera++;
  });

  return { kirim:k, dolanSera, kapatilanDonem };
}
```

- [ ] **Adım 4: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 471, KALAN 0.

- [ ] **Adım 5: Mevcut import'u yeni çekirdeğe bağla**

`scv-saha-v1.html:7409` civarındaki `GECMIS_KIRIM_SATIRLARI.forEach(satir=>{...})` gövdesinde kırım nesnesi kurulumu ve `seraPaylari.forEach` bloğu silinir; yerine:

```js
    const paylar = gecmisImportSeraAyristir(satir.seralar).map(sp=>{
      const sera = state.seralar.find(s=>(s.ad||'').trim().toUpperCase()===sp.ad.toUpperCase());
      if(!sera){ bulunamayanSeralar.push('Satır '+satir.no+': '+sp.ad); return null; }
      return { ad: sp.ad, seraId: sera.id, dizi: sp.dizi, yarim:false };
    }).filter(Boolean);

    const sonuc = kirimSatiriUygula({
      kirim: satir.kirim, dizim: satir.dizim, cesit, ortDiziKg: ortKg,
      soldurmaGun: soldurma, kirimNo, tarlaIds, paylar
    }, oturum);
    sonuc.kirim.gecmisImport = true;   // yalnızca geçmiş import bu işareti taşır
    olusanKirim++; toplamDizi += sonuc.kirim.diziSayisi; kapatilanDonem += sonuc.kapatilanDonem;
```

`seraSonDolduranSatir` sözlüğü yerine döngüden önce `const oturum = { seraSonDolduran: {} };` tanımlanır.

> **Dikkat:** geçmiş import 2. turu satır **numarasıyla**, yeni çekirdek kırım **tarihiyle** ayırt ediyor. `GECMIS_KIRIM_SATIRLARI`'nda aynı tarihte birden fazla satır var (ör. no 4 ve 5 aynı gün değil ama no 6 ve 7 `2026-07-03`); bu satırlar farklı seralar kullandığı için davranış değişmiyor. Adım 6 bunu doğruluyor — geçmezse çekirdek `satir.no`'yu opsiyonel `oturumAnahtar` alanı olarak almalı.

- [ ] **Adım 6: Mevcut import testlerinin hâlâ geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 471, KALAN 0. **Herhangi bir geçmiş import testi kalırsa ayrıştırma davranışı değiştirmiştir** — yukarıdaki uyarıya dön, çekirdeğe `oturumAnahtar` ekle.

- [ ] **Adım 7: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "fotoğraftan aktar: satır uygulama çekirdeği ayrıştırıldı, geçmiş import ona bağlandı"
```

---

### Görev 5: Çeşit kodu eşlemesi (state alanı)

Kâğıttaki `kod:3` gibi kodları uygulamadaki çeşit adına bağlayan, öğrenilen tablo.

**Dosyalar:**
- Değiştir: `scv-saha-v1.html:3071` (`bosState`), `:3083` (`stateNormalizeEt`), `:3240` (`SYNC_KOLEKSIYONLARI`)
- Değiştir: `firestore.rules`
- Test: `tests/run.js`

**Arayüzler:**
- Ürettiği: `state.cesitKodEslemesi` → `[{id, kod, cesit}]`, ve `fotoCesitCoz(kod, st)` → `string|null`

**Nesne değil dizi:** senkron makinesi `SYNC_KOLEKSIYONLARI`'ndaki her girdinin `id` taşıyan kayıtlardan oluşan dizi olmasını varsayıyor (`:3240`, `:3262`). Düz eşleme nesnesi o makineye oturmaz.

- [ ] **Adım 1: Başarısız testi yaz**

```js
bolum('Fotoğraftan aktar — çeşit kodu eşlemesi');
{
  // Yeni koleksiyon üç yere birden eklenmezse sessizce bozuluyor
  const app = kur();
  dogru(Array.isArray(app.state.cesitKodEslemesi), 'boş state alanı dizi olarak taşır');
  dogru(app.SYNC_KOLEKSIYONLARI.includes('cesitKodEslemesi'), 'senkron listesine eklenmiş');

  app.state.cesitKodEslemesi.push({ id:'e1', kod:'kod:3', cesit:'BSB 6195' });
  esit(app.fotoCesitCoz('kod:3', app.state), 'BSB 6195', 'bilinen kod çözülür');
  esit(app.fotoCesitCoz('KOD:3', app.state), 'BSB 6195', 'büyük/küçük harf ayrımı yok');
  esit(app.fotoCesitCoz('kod:9', app.state), null, 'bilinmeyen kod null döner');
  app._temizle();
}
{
  // Alanı hiç bilmeyen ESKİ kayıttan açılış — v107 hatasının tekrarı olmasın
  const eski = kur({ localStorage: { scvSahaKrokiV1: JSON.stringify({ tarlalar: [], seralar: [], kirimlar: [] }) } });
  dogru(Array.isArray(eski.state.cesitKodEslemesi), 'eski kayıttan açılışta alan diriltilir');
  esit(eski.fotoCesitCoz('kod:1', eski.state), null, 'eski kayıtta çözüm null, çökme yok');
  eski._temizle();
}
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`
Beklenen: `cesitKodEslemesi` dizi değil (undefined).

- [ ] **Adım 3: Üç yere birden ekle**

`bosState()` sonuna `cesitKodEslemesi: []`;
`stateNormalizeEt()` içine `state.cesitKodEslemesi = state.cesitKodEslemesi || [];`
`SYNC_KOLEKSIYONLARI` sonuna `'cesitKodEslemesi'`;
`firestore.rules` içindeki `collection in [...]` listesine `'cesitKodEslemesi'`.

Ve çözücü:

```js
/* Kâğıttaki tohum kodunu (kod:3) uygulamadaki çeşit adına çevirir.
   Eşleme kullanıcı onay ekranında bir kez seçtiğinde öğrenilir; kod sistemi
   sezonluk değişebildiği için kodun kendisi hiçbir yere gömülmez. */
function fotoCesitCoz(kod, st){
  if(!kod) return null;
  const aranan = String(kod).trim().toUpperCase();
  const kayit = (st.cesitKodEslemesi||[]).find(e=>String(e.kod||'').trim().toUpperCase()===aranan);
  return kayit ? kayit.cesit : null;
}
```

- [ ] **Adım 4: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 477, KALAN 0. Commit sırasında pre-commit hook `SYNC_KOLEKSIYONLARI` ↔ `firestore.rules` karşılaştırmasını yapar; rules'a eklemeyi unutursan commit engellenir.

- [ ] **Adım 5: Commit**

```bash
git add scv-saha-v1.html firestore.rules tests/run.js
git commit -m "fotoğraftan aktar: çeşit kodu eşlemesi koleksiyonu"
```

- [ ] **Adım 6: Firebase Console'dan rules'u yayınla**

`firestore.rules` değişti; Console'dan **manuel publish** gerekiyor. Yapılmazsa yeni koleksiyon senkronu izin hatası verir. Yayınladıktan sonra canlıda bir kayıt ekleyip başka cihazda göründüğünü doğrula.

---

### Görev 6: Anahtar saklama ve model çağrısı

**Dosyalar:**
- Değiştir: `scv-saha-v1.html` (Görev 5'in altına), Ayarlar bölümü
- Değiştir: `sw.js:44` civarı
- Değiştir: `tests/harness.js:300` (fetch enjeksiyonu)
- Test: `tests/run.js`

**Arayüzler:**
- Ürettiği: `fotoAnahtarOku()`, `fotoAnahtarYaz(deger)`, `fotoIstekGovdesi(base64, tur, st)`, `fotoOku(base64, tur, st)` → `Promise<satirlar>`

- [ ] **Adım 1: Harness'e fetch enjeksiyonu ekle**

`tests/harness.js:300`:

```js
    fetch: sec.fetch || (() => Promise.reject(new Error('ağ testte kapalı'))),
```

- [ ] **Adım 2: Başarısız testi yaz**

```js
bolum('Fotoğraftan aktar — anahtar ve çağrı');
{
  const app = kur();
  esit(app.fotoAnahtarOku(), '', 'anahtar girilmemişken boş');
  app.fotoAnahtarYaz('sk-ant-test123');
  esit(app._depo.getItem('scvYzAnahtar'), 'sk-ant-test123', 'anahtar cihaza yazılır');
  esit(app.fotoAnahtarOku(), 'sk-ant-test123', 'anahtar geri okunur');

  // EN ÖNEMLİ TEST: anahtar state'e sızmamalı — state Firestore'a ve yedeğe gidiyor
  yanlis(JSON.stringify(app.state).includes('sk-ant-test123'), 'anahtar state içine SIZMAZ');
  yanlis(app.SYNC_KOLEKSIYONLARI.some(k=>k.toLowerCase().includes('anahtar')), 'anahtar senkron listesinde yok');
  app._temizle();
}
{
  // İstek gövdesi: model kimliği, çözünürlük ve şema sabitleri
  const app = kur();
  app.state.seralar.push({ id:'s1', ad:'D24', kapasite:400, bolge:'kalemli', donemler:[] });
  app.state.tarlalar.push({ id:'t1', ad:'K21', dekar:51, cesit:'PVH 2310', viyolDekar:21, yerOcagiDekar:30, bolge:'kalemli' });

  const govde = app.fotoIstekGovdesi('BASE64VERI', 'tablo', app.state);
  esit(govde.model, 'claude-opus-5', 'model kimliği tam');
  dogru(govde.max_tokens >= 8000, 'max_tokens düşünme + metni birlikte karşılayacak kadar bol');
  esit(govde.output_config.format.type, 'json_schema', 'yapılandırılmış çıktı istenir');
  dogru(govde.output_config.format.schema.additionalProperties === false, 'şema kapalı');
  const metin = JSON.stringify(govde.messages);
  dogru(metin.includes('D24'), 'bilinen sera adları prompt\'a gömülür');
  dogru(metin.includes('K21'), 'bilinen tarla kodları prompt\'a gömülür');
  dogru(/üstü çizili/i.test(metin), 'üstü çizili satır talimatı var');
  dogru(metin.includes('BASE64VERI'), 'görüntü gövdeye eklenir');
  app._temizle();
}
{
  // Çağrı: başarılı cevabın ayrıştırılması
  const cagrilar = [];
  const app = kur({ localStorage: { scvYzAnahtar:'sk-test' }, fetch: (url, ayar) => {
    cagrilar.push({ url, ayar });
    return Promise.resolve({ ok:true, status:200, json: () => Promise.resolve({
      content: [{ type:'text', text: JSON.stringify({ satirlar:[{ no:1, kirim:'2026-07-24', dizim:'2026-07-26', seralar:['D24'] }] }) }],
      stop_reason: 'end_turn'
    }) });
  }});
  return app.fotoOku('BASE64', 'tablo', app.state).then(satirlar=>{
    esit(satirlar.length, 1, 'cevaptaki satırlar ayrıştırılır');
    esit(satirlar[0].seralar, ['D24'], 'sera listesi taşınır');
    dogru(cagrilar[0].url.includes('api.anthropic.com'), 'doğru adrese gidilir');
    esit(cagrilar[0].ayar.headers['x-api-key'], 'sk-test', 'anahtar başlığa konur');
    esit(cagrilar[0].ayar.headers['anthropic-version'], '2023-06-01', 'sürüm başlığı gönderilir');
    app._temizle();
  });
}
```

> Son blok söz (Promise) döndürüyor; `tests/run.js` şu an eşzamanlı. Testi yazmadan önce dosyanın sonundaki özet çıktısının (`GEÇEN/KALAN`) sözler çözüldükten sonra basıldığından emin ol — gerekirse asenkron blokları bir diziye toplayıp `Promise.all(...).then(ozetYaz)` ile sarmala ve mevcut özet çağrısını oraya taşı.

- [ ] **Adım 3: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`
Beklenen: `fotoAnahtarOku is not a function`.

- [ ] **Adım 4: Anahtar saklamayı yaz**

```js
const FOTO_ANAHTAR_DEPO = 'scvYzAnahtar';

/* API anahtarı state'e DEĞİL cihaza yazılır. state Firestore'a senkronlanıyor
   ve yedek dosyasına giriyor; anahtar oraya girerse buluta ve indirilen yedeğe
   sızar. scvTema/scvLang ile aynı kalıp: depolama kapalıysa sessizce boş. */
function fotoAnahtarOku(){
  try{ return localStorage.getItem(FOTO_ANAHTAR_DEPO) || ''; }catch(e){ return ''; }
}
function fotoAnahtarYaz(deger){
  try{
    if(deger) localStorage.setItem(FOTO_ANAHTAR_DEPO, String(deger).trim());
    else localStorage.removeItem(FOTO_ANAHTAR_DEPO);
  }catch(e){ /* depolama kapalı: bu oturumluk kalır */ }
}
```

- [ ] **Adım 5: İstek gövdesini yaz**

```js
const FOTO_MODEL = 'claude-opus-5';
const FOTO_UZUN_KENAR = 2576;   // modelin okuyabildiği en yüksek çözünürlük
const FOTO_MAX_TOKEN = 8000;    // düşünme + metin birlikte sınırlanıyor

/* Tablo satırı şeması. additionalProperties:false ile kapalı — model uydurma
   alan ekleyemez, eksik alan bırakamaz. Okunamayan hücre null. */
const FOTO_TABLO_SEMA = {
  type:'object', additionalProperties:false, required:['satirlar'],
  properties:{ satirlar:{ type:'array', items:{
    type:'object', additionalProperties:false,
    required:['no','tohumKodu','yetistirme','kirim','dizim','seralar','soldurmaGun'],
    properties:{
      no:{ type:'integer' },
      tohumKodu:{ type:['string','null'] },
      yetistirme:{ type:['string','null'], enum:['viyol','yerOcagi','karma',null] },
      kirim:{ type:['string','null'], description:'YYYY-MM-DD' },
      dizim:{ type:['string','null'], description:'YYYY-MM-DD' },
      seralar:{ type:'array', items:{ type:'string' } },
      soldurmaGun:{ type:['integer','null'] }
    } } } }
};

const FOTO_DEFTER_SEMA = {
  type:'object', additionalProperties:false, required:['satirlar'],
  properties:{ satirlar:{ type:'array', items:{
    type:'object', additionalProperties:false,
    required:['no','tarlaKodu','dekar','tarih','cesit','yetistirme','kirimNo'],
    properties:{
      no:{ type:'integer' },
      tarlaKodu:{ type:['string','null'] },
      dekar:{ type:['number','null'] },
      tarih:{ type:['string','null'], description:'YYYY-MM-DD' },
      cesit:{ type:['string','null'] },
      yetistirme:{ type:['string','null'], enum:['viyol','yerOcagi','karma',null] },
      kirimNo:{ type:['integer','null'] }
    } } } }
};

function fotoTalimat(tur, st){
  const seralar = st.seralar.map(s=>s.ad).join(', ');
  const tarlalar = st.tarlalar.map(t=>t.ad).join(', ');
  const ortak =
    'Bu bir el yazısı tarım kaydı. Yalnızca gördüğünü yaz, ASLA tahmin etme.\n' +
    'Okunamayan hücreyi null bırak — uydurma.\n' +
    'ÜSTÜ ÇİZİLİ satırları hiç okuma, çıktıya koyma.\n' +
    'Arka sayfadan vuran soluk mürekkebi yok say.\n' +
    'Tarihleri YYYY-MM-DD biçimine çevir (kâğıtta gg.aa.yyyy yazıyor).\n';
  if(tur==='tablo'){
    return ortak +
      'Sütunlar soldan sağa: TOHUM ÇEŞİDİ, YETİŞTİRME B., KIRIM TARİHİ, DİZİM TARİHİ, SERA NUMARALARI, SOLDURMA B.\n' +
      'YETİŞTİRME B. değerleri: "Viyol"→viyol, "Yerocağı"→yerOcagi, "Viyol-Yer o."→karma.\n' +
      'SERA NUMARALARI hücresindeki her serayı ayrı bir dize olarak yaz.\n' +
      'Bir sera "(YARIM)" ile işaretliyse adının sonuna * koy (örnek: D19*).\n' +
      'SOLDURMA B. "3gün" gibi yazılı — yalnızca sayıyı ver.\n' +
      'Uygulamada kayıtlı sera adları (yalnızca bunlardan seç): ' + seralar + '\n';
  }
  return ortak +
    'Her satır şu kalıpta: TARLA KODU - DEKAR da → TARİH (ÇEŞİT YETİŞTİRME kırım no)\n' +
    'Örnek: "K21 - 52 da → 15.07.2026 (PVH 2310 Yer Ocağı 1.kırım)"\n' +
    '"Yer Ocağı"→yerOcagi, "Viyol"→viyol, "Yer O.-Viyol"→karma.\n' +
    'Uygulamada kayıtlı tarla kodları (yalnızca bunlardan seç): ' + tarlalar + '\n';
}

function fotoIstekGovdesi(base64, tur, st){
  return {
    model: FOTO_MODEL,
    max_tokens: FOTO_MAX_TOKEN,
    output_config: { format: { type:'json_schema',
      schema: tur==='tablo' ? FOTO_TABLO_SEMA : FOTO_DEFTER_SEMA } },
    messages: [{ role:'user', content:[
      { type:'image', source:{ type:'base64', media_type:'image/jpeg', data: base64 } },
      { type:'text', text: fotoTalimat(tur, st) }
    ] }]
  };
}
```

- [ ] **Adım 6: Çağrıyı yaz**

```js
/* Tek ağ çağrısı. Tarayıcıdan doğrudan API'ye gidiliyor; sunucu yok.
   anthropic-dangerous-direct-browser-access başlığı CORS için gerekli. */
function fotoOku(base64, tur, st){
  const anahtar = fotoAnahtarOku();
  if(!anahtar) return Promise.reject(new Error('Ayarlar\'dan API anahtarı girin.'));
  return fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-api-key': anahtar,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body: JSON.stringify(fotoIstekGovdesi(base64, tur, st))
  }).then(r=>{
    if(!r.ok) return r.text().then(t=>{ throw new Error('API hatası ' + r.status + ': ' + t.slice(0,200)); });
    return r.json();
  }).then(cevap=>{
    if(cevap.stop_reason === 'max_tokens'){
      throw new Error('Cevap yarıda kesildi — fotoğrafı ikiye bölüp tekrar deneyin.');
    }
    if(cevap.stop_reason === 'refusal'){
      throw new Error('Model bu görüntüyü işlemeyi reddetti.');
    }
    const metin = (cevap.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    let ayristirilmis;
    try{ ayristirilmis = JSON.parse(metin); }
    catch(e){ throw new Error('Cevap okunamadı (beklenen JSON gelmedi).'); }
    return ayristirilmis.satirlar || [];
  });
}
```

- [ ] **Adım 7: Service worker by-pass'ını ekle**

`sw.js`, hava durumu satırının (`:44`) hemen altına:

```js
  if (url.includes('api.anthropic.com')) {
    return; // model çağrısı: her zaman ağdan, asla önbelleğe alma
  }
```

- [ ] **Adım 8: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 491, KALAN 0.

- [ ] **Adım 9: Tarayıcıdan doğrudan çağrıyı CANLIDA doğrula**

Bu planın tek doğrulanmamış varsayımı. Uygulamayı aç, Ayarlar'a gerçek anahtarı gir, küçük bir görüntüyle tek istek at, konsolu izle.
- **Geçerse:** devam.
- **CORS hatası verirse:** DUR ve kullanıcıya haber ver. Tasarımın geri kalanı aynı kalır, yalnızca `fotoOku`'nun adresi Cloud Functions proxy'sine döner (Blaze planı gerekir). Plan bu noktadan itibaren yeniden değerlendirilir.

- [ ] **Adım 10: Commit**

```bash
git add scv-saha-v1.html sw.js tests/harness.js tests/run.js
git commit -m "fotoğraftan aktar: anahtar saklama ve model çağrısı"
```

---

### Görev 7: Görüntü hazırlama

**Dosyalar:**
- Değiştir: `scv-saha-v1.html`
- Test: `tests/run.js`

**Arayüzler:**
- Ürettiği: `fotoOlcekHesapla(en, boy)` → `{en, boy}` (saf), `fotoGoruntuHazirla(dosya, derece)` → `Promise<base64>` (canvas, testsiz)

- [ ] **Adım 1: Başarısız testi yaz**

```js
bolum('Fotoğraftan aktar — görüntü ölçeği');
{
  const app = kur();
  esit(app.fotoOlcekHesapla(4000, 3000), { en:2576, boy:1932 }, 'büyük yatay foto uzun kenardan 2576ya iner');
  esit(app.fotoOlcekHesapla(3000, 4000), { en:1932, boy:2576 }, 'dikey fotoda uzun kenar boy');
  esit(app.fotoOlcekHesapla(1200, 900), { en:1200, boy:900 }, 'küçük foto BÜYÜTÜLMEZ (yok olan ayrıntı üretilmez)');
  app._temizle();
}
```

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Çalıştır: `node tests/run.js`

- [ ] **Adım 3: Fonksiyonları yaz**

```js
/* Uzun kenarı 2576'ya ayarlar. Bu bir KÜÇÜLTME hedefi değil isabet hedefi:
   modelin okuyabildiği en yüksek çözünürlük bu ve C21 ile C24'ü ayıran şey
   tam olarak o pikseller. Küçük fotoğraf büyütülmez — olmayan ayrıntı
   üretmek okumayı iyileştirmez, yalnızca jeton harcar. */
function fotoOlcekHesapla(en, boy){
  const uzun = Math.max(en, boy);
  if(uzun <= FOTO_UZUN_KENAR) return { en, boy };
  const oran = FOTO_UZUN_KENAR / uzun;
  return { en: Math.round(en*oran), boy: Math.round(boy*oran) };
}

/* Dosyayı canvas'ta ölçekleyip base64 JPEG'e çevirir. `derece` 0/90/180/270 —
   kâğıt sahada kolayca ters çekiliyor (elimizdeki iki örnek de ters). */
function fotoGoruntuHazirla(dosya, derece){
  return new Promise((coz, red)=>{
    const okuyucu = new FileReader();
    okuyucu.onerror = ()=>red(new Error('Fotoğraf okunamadı.'));
    okuyucu.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>red(new Error('Fotoğraf çözülemedi.'));
      img.onload = ()=>{
        const d = ((Number(derece)||0) % 360 + 360) % 360;
        const dik = d===90 || d===270;
        const olcek = fotoOlcekHesapla(dik ? img.height : img.width, dik ? img.width : img.height);
        const c = document.createElement('canvas');
        c.width = olcek.en; c.height = olcek.boy;
        const ctx = c.getContext('2d');
        ctx.translate(olcek.en/2, olcek.boy/2);
        ctx.rotate(d * Math.PI / 180);
        const ciz = dik ? [olcek.boy, olcek.en] : [olcek.en, olcek.boy];
        ctx.drawImage(img, -ciz[0]/2, -ciz[1]/2, ciz[0], ciz[1]);
        coz(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.src = okuyucu.result;
    };
    okuyucu.readAsDataURL(dosya);
  });
}
```

- [ ] **Adım 4: Testin geçtiğini gör**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 494, KALAN 0.

- [ ] **Adım 5: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "fotoğraftan aktar: görüntü 2576px uzun kenara ayarlanır, çevirme desteği"
```

---

### Görev 8: Onay ekranı

**Dosyalar:**
- Değiştir: `scv-saha-v1.html` (kırım sayfası düğmesi, modal, CSS, Ayarlar alanı)

**Arayüzler:**
- Kullandığı: Görev 1–7'nin tamamı
- Ürettiği: `fotoAktarAc()`, `fotoOnayRender()`, `fotoSatirDuzelt(indeks, alan, deger)`

Akış: **defter önce, tablo sonra.** Ekran hangisini beklediğini yazar; defter satırları bellekte tutulur, tablo satırlarının tarla eşlemesinde kullanılır.

- [ ] **Adım 1: Ayarlar'a anahtar alanını ekle**

Ayarlar bölümüne, mevcut alan kalıbıyla:

```html
<div class="field">
  <label>Yapay Zekâ API Anahtarı</label>
  <input id="ayarYzAnahtar" type="password" placeholder="sk-ant-..." autocomplete="off">
  <div class="hint">Fotoğraftan aktar özelliği için. Yalnızca bu cihazda saklanır, yedeğe ve buluta gitmez.</div>
</div>
```

Kaydetme yolunda `fotoAnahtarYaz(document.getElementById('ayarYzAnahtar').value)`; açılışta `fotoAnahtarOku()` ile doldur.

- [ ] **Adım 2: Kırım sayfasına düğmeyi ve dosya girdisini ekle**

`:2107`'deki yedek girdisi kalıbıyla:

```html
<input type="file" id="fotoAktarInput" accept="image/*" capture="environment" style="display:none" onchange="fotoDosyaSecildi(this)">
<button class="btn" onclick="fotoAktarAc()">Fotoğraftan Aktar</button>
```

- [ ] **Adım 3: Modal ve satır kartlarını yaz**

`fotoOnayRender()` tek bir modal gövdesi üretir ve `fotoDurum.asama`'ya göre üç ekrandan birini çizer: `defter` (fotoğraf iste + "Defterim yok, devam et"), `tablo` (fotoğraf iste, üstte defterden okunan tarla sayısı), `onay` (satır kartları + Uygula).

Yazmadan önce mevcut bir modal render fonksiyonunu örnek al — sera detay modali (`:5504` civarı) hem kart listesi hem düzenlenebilir alan içerdiği için en yakın kalıp. Aynı sınıf adlarını ve `closeModal()` çıkışını kullan.

Durum renkleri mevcut tasarım belirteçlerinden alınır (çıplak renk yasak): yeşil/sarı/gri/kırmızı için `:root`'taki durum belirteçleri kullanılır — karşılığı yoksa mevcut rozet sınıfları yeniden kullanılır, yeni çıplak renk **tanımlanmaz**. Punto `--fs-*`, yarıçap `--r-*`, geçiş `--gecis-*`.

Her satır kartında: durum şeridi, bayrak metinleri, düzenlenebilir hücreler (`kirim`, `dizim`, `soldurmaGun`, sera listesi, çeşit açılır listesi). Kırmızı satırın "Uygula" onay kutusu kapalı ve devre dışı.

Üstte toplu özet: `N yeşil · N sarı · N atlanacak · N uygulanamaz`.

**Ekranın tuttuğu durum** — modal açıkken yaşayan, kapanınca sıfırlanan tek nesne:

```js
/* Onay ekranının belleği. Defter ÖNCE okunur ve burada tutulur; tablo
   satırlarının tarla bağı bu listeden kurulur (fotoTarlaEsle). Defter
   satırları state'e ayrı kayıt olarak YAZILMAZ — veri modeli değişmiyor. */
let fotoDurum = { asama:'defter', defter:[], satirlar:[], derece:0, mesgul:false };

function fotoAktarAc(){
  if(!fotoAnahtarOku()){ uyar('Önce Ayarlar\'dan API anahtarını girin.'); return; }
  fotoDurum = { asama:'defter', defter:[], satirlar:[], derece:0, mesgul:false };
  fotoOnayRender();
}

/* Dosya seçildi: hazırla → oku → denetle → ekranı tazele.
   `mesgul` bayrağı çift gönderimi engelliyor — okuma saniyeler sürüyor ve
   sahada kullanıcı düğmeye ikinci kez basıyor. */
function fotoDosyaSecildi(girdi){
  const dosya = girdi.files && girdi.files[0];
  girdi.value = '';                       // aynı dosya tekrar seçilebilsin
  if(!dosya || fotoDurum.mesgul) return;
  const asama = fotoDurum.asama;
  fotoDurum.mesgul = true; fotoOnayRender();
  fotoGoruntuHazirla(dosya, fotoDurum.derece)
    .then(b64 => fotoOku(b64, asama === 'defter' ? 'defter' : 'tablo', state))
    .then(hamSatirlar => {
      if(asama === 'defter'){
        fotoDurum.defter = fotoDefterDenetle(hamSatirlar, state);
        fotoDurum.asama = 'tablo';
      } else {
        fotoDurum.satirlar = fotoTabloDenetle(hamSatirlar, state).map(r=>{
          const esleme = fotoTarlaEsle(r.satir, fotoDurum.defter);
          return Object.assign(r, esleme, { secili: r.durum!=='gri' && r.durum!=='kirmizi' });
        });
        fotoDurum.asama = 'onay';
      }
    })
    .catch(e => uyar(e.message || 'Fotoğraf okunamadı.'))
    .then(() => { fotoDurum.mesgul = false; fotoOnayRender(); });
}
```

Defter aşaması **atlanabilir** olmalı ("Defterim yok, devam et" düğmesi): defter yoksa tablo satırları tarlasız kayıt açar ve mevcut kod bunu zaten destekliyor.

- [ ] **Adım 4: Uygula düğmesini bağla**

Düğme `fotoOnayRender()`'ın `onay` aşamasında çizilir: `<button class="btn btn-primary" onclick="fotoUygula()">Uygula</button>`.

```js
function fotoUygula(){
  const uygulanacak = fotoDurum.satirlar.filter(r=>r.durum!=='gri' && r.durum!=='kirmizi' && r.secili);
  if(!uygulanacak.length){ uyar('Uygulanacak satır yok.'); return; }
  const sariSayi = uygulanacak.filter(r=>r.durum==='sari').length;
  /* Hepsi sarıysa kullanıcı bayrakları körlemesine geçiyor olabilir — ikinci onay. */
  if(sariSayi === uygulanacak.length && sariSayi > 1){
    if(!onayla('Uygulanacak ' + sariSayi + ' satırın TAMAMINDA uyarı var. Yine de devam edilsin mi?')) return;
  }
  if(!onayla(uygulanacak.length + ' satır uygulanacak. Devam edilsin mi?')) return;

  silmeYedekAl(['kirimlar','seralar'], 'Fotoğraftan aktarım');
  const oturum = { seraSonDolduran: {} };
  let acilanKirim = 0, kapanan = 0;
  uygulanacak.forEach(r=>{
    const sonuc = kirimSatiriUygula({
      kirim: r.satir.kirim, dizim: r.satir.dizim,
      cesit: fotoCesitCoz(r.satir.tohumKodu, state) || r.satir.cesitSecimi || '',
      ortDiziKg: 0,
      soldurmaGun: r.satir.soldurmaGun,
      kirimNo: r.kirimNo != null ? r.kirimNo : null,
      tarlaIds: r.tarlaIds || [],
      paylar: r.paylar
    }, oturum);
    acilanKirim++; kapanan += sonuc.kapatilanDonem;
  });
  saveState(); renderAll(); closeModal();
  uyar('Aktarım tamamlandı.\nKırım kaydı: ' + acilanKirim + '\nKapatılan sera dönemi: ' + kapanan);
}
```

- [ ] **Adım 5: Testleri çalıştır**

Çalıştır: `node tests/run.js`
Beklenen: GEÇEN 494, KALAN 0 (UI görevi yeni test eklemiyor; regresyon olmamalı).

- [ ] **Adım 6: Commit**

```bash
git add scv-saha-v1.html
git commit -m "fotoğraftan aktar: onay ekranı ve Ayarlar'da anahtar alanı"
```

---

### Görev 9: Görsel doğrulama ve canlı deneme

**Dosyalar:** yok (doğrulama görevi)

- [ ] **Adım 1: Dar ekran render'ı**

Çalıştır: `python tests/gorsel.py`
Beklenen: 360/390/430px × açık/koyu — yatay taşma 0px, kırpılan etiket yok. Onay ekranı kartları 360px'te okunur olmalı.

- [ ] **Adım 2: Gerçek fotoğrafla uçtan uca deneme**

Depoda duran `seralar güncel 2.jpeg` ile: fotoğrafı yükle, okumayı bekle, onay ekranını incele.
- Üstü çizili satır çıktıda **olmamalı**.
- Zaten kayıtlı satırlar **gri** görünmeli.
- Okumanın kodda yazılı `GECMIS_KIRIM_SATIRLARI` ile örtüşen kısmı doğru olmalı.

- [ ] **Adım 3: Tek satır uygula ve geri al**

Bir yeşil satırı uygula; kırım kaydının açıldığını, seranın dolduğunu, dizim tarihinin ayrı alanda durduğunu doğrula. Sonra geri alma zincirini kullanıp state'in eski hâline döndüğünü gör.

- [ ] **Adım 4: Başka cihazda senkronu doğrula**

`cesitKodEslemesi` yeni koleksiyon; ikinci bir cihazda uygulamayı açıp eşlemenin geldiğini gör. Gelmiyorsa Görev 5 Adım 6 (rules publish) atlanmıştır.

- [ ] **Adım 5: Sonuç commit'i ve push**

```bash
git add -A
git commit -m "fotoğraftan aktar: canlı doğrulama"
git push
```

Sürüm pre-commit hook tarafından otomatik artar; elle dokunma. Push sonrası github.io'da yeni sürümün geldiğini `APP_SURUM` etiketinden doğrula.

---

## Şartname Kapsam Kontrolü

| Şartname bölümü | Karşılayan görev |
| --- | --- |
| İki kâğıt, tek olay — defter tarla eşlemesi (`fotoTarlaEsle`) | 3, 8 |
| Ölçülen kanıt — tarla düzeltme önerisi | 3 |
| Anahtar (Ayarlar), state'e sızmaz | 6, 8 |
| Görüntü hazırlama 2576px + çevirme | 7 |
| Okuma, yapılandırılmış çıktı, prompt'a gömülen listeler | 6 |
| Üstü çizili / (YARIM) / null talimatları | 6 (prompt), 1 (`*` çözümü) |
| `max_tokens` ≥ 8000 ve kesilme yakalama | 6 |
| sw by-pass | 6 |
| Denetim kuralları — tablo | 2 |
| Denetim kuralları — defter | 3 |
| Kısmi eşleşme | 2 |
| Çeşit kodu eşlemesi (dizi + 4 yer) | 5 |
| Onay ekranı, renkler, toplu özet | 8 |
| `kirimSatiriUygula` ayrıştırması | 4 |
| Geri alma zinciri | 8 |
| Testler ve görsel doğrulama | her görev + 9 |

**Bilerek dışarıda:** depo/kutulama sayfaları, ödemeler, fotoğrafın saklanması — şartnamede kapsam dışı yazılı.

## Açık Riskler

- **Görev 6 Adım 9 bir kapı.** Tarayıcıdan doğrudan çağrı engellenirse plan orada durur ve mimari kararı yeniden alınır. Bu yüzden ağ çağrısı görevi UI'dan önce geliyor — engelle karşılaşırsak boşa yazılmış ekran olmaz.
- **Görev 4 Adım 6 bir kapı.** Geçmiş import testleri kalırsa ayrıştırma davranış değiştirmiştir; çekirdeğe `oturumAnahtar` eklenip yeniden koşulur.
- Test sayıları (438, 450, 459...) tahmindir; iddiaların sayısı yazarken değişebilir. Önemli olan **KALAN 0** ve sayının düşmemesi.

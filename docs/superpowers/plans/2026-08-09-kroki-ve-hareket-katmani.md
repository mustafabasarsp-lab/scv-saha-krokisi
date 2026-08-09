# Kroki Kutuları ve Hareket Katmanı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Bu projede alt ajan kullanılmaz** (bkz. CLAUDE.md): iş ana oturumda yapılır.

**Goal:** Sera kutularını okunur hâle getirmek (eşit 44px + uzun basma ile silme) ve tasarım sistemine eksik olan hareket katmanını eklemek.

**Architecture:** Değişikliklerin tamamı tek dosyada (`scv-saha-v1.html`) — CSS `<style>` bloğu ve inline `<script>`. Hareket, belirteç tabanlı CSS geçişleriyle kurulur; JS yalnızca sınıf ekler/kaldırır. Tek istisna senkron vurgusu: neyin uzaktan değiştiğini yalnızca `baglamFirestoreDinleyici` bilir.

**Tech Stack:** Vanilla HTML/CSS/JS (çatı yok, derleme adımı yok), Firebase Firestore compat SDK, Node test harness (`tests/harness.js`), Playwright (görsel doğrulama).

## Global Constraints

- **Çıplak renk yasak.** Bileşen kurallarında sabit renk yok; yalnızca `:root` ve yazdırma bloğu. Yeni her renk belirteçten gelir.
- **12px mutlak punto tabanı** (`--fs-xs`). Altına inen her değer `:root`'ta yorumla belgelenmiş istisna olmak zorundadır.
- **Yarıçap ölçeği:** `--r-xs:6px` > `--r-sm:8px` > `--r-md:12px` > `--r-lg:16px` > `--r-pill:999px`.
- **Kullanılmayan belirteç süstür** — tanımlanan her belirteç bu planın sonunda fiilen kullanılıyor olmalı.
- **Sürümü elle değiştirme.** `APP_SURUM` ve `sw.js`'teki `CACHE_NAME` pre-commit hook tarafından artırılır.
- **`.tarla-box` arazi parseli / `.sera-box` dolan kap** metafor farkı korunur (3px vs 6px yarıçap, kenar/doku farkları). Değişen yalnızca genişlik.
- Her görev sonunda `node tests/run.js` yeşil olmalı (başlangıç: 393 geçiyor).
- Türkçe kullanıcı metinleri `i18n()` üzerinden geçer.

## Dosya Yapısı

| Dosya | Sorumluluk | Bu planda |
| --- | --- | --- |
| `scv-saha-v1.html` | Uygulamanın tamamı | CSS + render + yeni JS bölümleri |
| `tests/run.js` | Regresyon iddiaları | Yeni davranışlar için testler |
| `tests/gorsel.py` | Playwright görsel doğrulama | **Yeni** — kalıcı araç |

`tests/gorsel.py` bilerek kalıcı: 360–390px doğrulaması v88'den beri açık olan boşluktu, tek seferlik betik olarak scratchpad'de kalmamalı.

---

### Task 1: Görsel doğrulama aracını kalıcılaştır

Sonraki her görev bunu kullanacak. Önce bu gelmeli.

**Files:**
- Create: `tests/gorsel.py`

**Interfaces:**
- Produces: `python tests/gorsel.py [çıktı-dizini]` → 360/390/430px ekran görüntüleri + ölçüm çıktısı; hata varsa çıkış kodu 1.

- [ ] **Step 1: Aracı yaz**

`tests/gorsel.py`:

```python
# -*- coding: utf-8 -*-
"""SCV Saha — dar telefon genişliklerinde görsel doğrulama.

Neden var: resize_window tarayıcı penceresini 627px altına indiremiyordu, bu
yüzden 360–390px hiçbir tasarım turunda gözle doğrulanamadı. Playwright viewport'u
doğrudan kurduğu için o boşluk kapanıyor.

Giriş ekranı Firebase'e bağlı; örnek veri localStorage'a yazılır, sayfa
yüklendikten sonra giriş katmanı gizlenip renderAll çağrılır.

Kullanım:  python tests/gorsel.py [cikti-dizini]
Çıkış kodu 1 = yatay taşma ya da etiket taşması var.
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parent.parent
CIKTI = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else KOK / "tests" / "_gorsel")
CIKTI.mkdir(parents=True, exist_ok=True)
OLCULER = [(360, 740), (390, 844), (430, 932)]


def tarla(i, ad, bolge, dekar):
    return {"id": f"t{i}", "ad": ad, "bolge": bolge, "dekar": dekar, "cesit": "Basma",
            "ciftci": "M. Başar", "viyolDekar": dekar, "yerOcagiDekar": 0,
            "dikimTarihi": "2026-04-12", "capaTarihi": "2026-05-20",
            "tahminiHasatKg": dekar * 180, "ilaclar": [], "zararlilar": [],
            "gubreler": [], "olusturma": 1}


def sera(i, ad, bolge, dolu, kap):
    d = {"id": f"s{i}", "ad": ad, "bolge": bolge, "kapasite": kap,
         "termometreVar": False, "donemler": [], "olusturma": 1}
    if dolu:
        d["donemler"] = [{"id": f"d{i}", "tur": "Tütün", "cesit": "Basma", "dolu": dolu,
                          "girisTarihi": "2026-07-28", "brandaRengi": "beyaz", "aktif": True,
                          "kaynaklar": [], "baslangic": 1, "bitis": None}]
    return d


# En uzun adlar bilerek içeride: kırpılma buradan çıkıyor.
STATE = {
    "tarlalar": [tarla(1, "K1", "kalemli", 33), tarla(2, "T2 Yol Üstü", "tekeliler", 23),
                 tarla(3, "T10", "tekeliler", 122), tarla(4, "K26", "kalemli", 75)],
    "seralar": [sera(1, "80 cm", "kalemli", 120, 200), sera(2, "90cm", "kalemli", 0, 240),
                sera(3, "100cm", "kalemli", 285, 400), sera(4, "B1", "kalemli", 400, 400),
                sera(5, "B2", "kalemli", 210, 400), sera(6, "C1", "kalemli", 0, 400),
                sera(7, "C2", "kalemli", 180, 400), sera(8, "D1", "tekeliler", 95, 400)],
    "kirimlar": [], "haritaPinleri": [], "tesisPinleri": [], "depoKutulari": [],
    "sulamaKayitlari": [], "iklimKayitlari": [], "dayibasilar": [], "yevmiyeKayitlari": [],
    "odemeKayitlari": [], "odemeAyarlari": [], "dizimAlanlari": [], "sahaPlanlari": [],
}

hata = []
with sync_playwright() as p:
    tarayici = p.chromium.launch()
    for genislik, yukseklik in OLCULER:
        for tema in ("light", "dark"):
            sayfa = tarayici.new_page(viewport={"width": genislik, "height": yukseklik},
                                      device_scale_factor=2, is_mobile=True, has_touch=True)
            sayfa.add_init_script(
                "localStorage.setItem('scvSahaKrokiV1', %s);"
                "localStorage.setItem('scvTema', '%s');" % (json.dumps(json.dumps(STATE)), tema))
            sayfa.goto((KOK / "scv-saha-v1.html").as_uri())
            sayfa.wait_for_timeout(2500)
            sayfa.evaluate("""() => {
                document.getElementById('loginOverlay').classList.add('hidden');
                if (typeof renderAll === 'function') renderAll();
            }""")
            sayfa.wait_for_timeout(600)
            sayfa.screenshot(path=str(CIKTI / f"scv-{genislik}-{tema}.png"), full_page=True)

            olcum = sayfa.evaluate("""() => {
                const tasma = document.documentElement.scrollWidth - document.documentElement.clientWidth;
                const kirpilan = [];
                document.querySelectorAll('.sera-box .label, .tarla-box .name').forEach(el => {
                    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                        kirpilan.push(el.textContent.trim());
                    }
                });
                const kutu = document.querySelector('.sera-box');
                return { tasma, kirpilan,
                         seraGen: kutu ? Math.round(kutu.getBoundingClientRect().width) : 0 };
            }""")
            etiket = f"{genislik}px/{tema}"
            print(f"{etiket:<14} yatay taşma={olcum['tasma']}px  sera kutusu={olcum['seraGen']}px  "
                  f"kırpılan={olcum['kirpilan'] or 'yok'}")
            if olcum["tasma"] > 0:
                hata.append(f"{etiket}: yatay taşma {olcum['tasma']}px")
            if olcum["kirpilan"]:
                hata.append(f"{etiket}: kırpılan etiket {olcum['kirpilan']}")
            sayfa.close()
    tarayici.close()

if hata:
    print("\nBAŞARISIZ:")
    for h in hata:
        print("  - " + h)
    sys.exit(1)
print("\nTamam: taşma ve kırpılma yok.")
```

- [ ] **Step 2: Çalıştır — mevcut kırpılmayı YAKALAMALI**

Run: `python tests/gorsel.py`
Expected: FAIL (çıkış kodu 1), `kırpılan etiket ['80 cm', '90cm', '100cm', 'T2 Yol Üstü']` benzeri satırlar. Araç doğru çalışıyorsa bugünkü hatayı görmek zorunda.

- [ ] **Step 3: Commit**

```bash
git add tests/gorsel.py
git commit -m "test: dar ekran görsel doğrulama aracı

resize_window 627px altına inemediği için 360-390px hiçbir tasarım turunda
doğrulanamamıştı. Araç bugünkü kırpılmayı yakalıyor: 80 cm, 90cm, 100cm ve
T2 Yol Üstü etiketleri kutularına sığmıyor."
```

---

### Task 2: Sera kutusu eşit 44px, kapasite sabitleri sökülür

**Files:**
- Modify: `scv-saha-v1.html` — `AYARLAR` (2353-2357), `.sera-box` CSS (811), `renderSeralar` (4646)
- Test: `tests/run.js`

**Interfaces:**
- Produces: `renderSeralar` artık `style="width:…"` üretmez; `.sera-box` genişliği CSS'ten sabit 44px.

- [ ] **Step 1: Genişliğin artık üretilmediğini iddia eden testi yaz**

`tests/run.js` içinde, dosyanın sonundaki `console.log` ayıracından ÖNCE:

```js
  bolum('Kroki — sera kutusu eşit genişlik');
  {
    const app = kur();
    app.state.seralar.push(
      { id:'s1', ad:'80 cm', bolge:'kalemli', kapasite:200, donemler:[] },
      { id:'s2', ad:'B1',    bolge:'kalemli', kapasite:400, donemler:[] }
    );
    app.renderSeralar();
    const html = app._belge.getElementById('seraPlot').innerHTML;
    yanlis(/style="width:/.test(html), 'kutu genişliği artık satır içi stille yazılmaz');
    dogru(html.includes('80 cm'), 'kısa kapasiteli sera yine çizilir');
    app._temizle();
  }
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `kutu genişliği artık satır içi stille yazılmaz  beklenen: false  gerçek: true`

- [ ] **Step 3: `AYARLAR`'dan iki sabiti sök**

`scv-saha-v1.html:2353-2357` şu hâle gelir:

```js
const AYARLAR = {
  GUNLUK_ISLEME_DIZI: 200     // seranın günlük işlenen tahmini dizi hızı (boşalma tahmini için)
};
```

- [ ] **Step 4: `renderSeralar`'daki genişlik hesabını kaldır**

`scv-saha-v1.html:4646` satırındaki `const width = …;` satırı silinir. Aynı fonksiyondaki kutu şablonundan `style="width:${width}px"` çıkarılır:

```js
    return `<div class="sera-box${seritMetni?' calisma-isaretli':''}" onclick="openSeraDetay('${s.id}')">
```

- [ ] **Step 5: CSS'te sabit genişliği ver**

`.sera-box` kuralına (`scv-saha-v1.html:811`) `width` eklenir ve gerekçesi yazılır:

```css
/* Genişlik eskiden kapasiteden türüyordu: (kapasite/480)x40px. 200 dizilik bir
   sera bu formülle 17px kalıyor, etiketi 39px yer istiyordu — ekranda "8." diye
   görünüyordu. Punto düşürmek çözmüyor, sorun kabın kendisindeydi. Artık eşit:
   kapasite detay modalinde okunur, ızgarada doluluk yüzdesi tek sinyaldir.
   44px aynı zamanda v88'in dokunma hedefi; eski 33px onun ALTINDAYDI. */
.sera-box{
  position:relative;
  width:44px;
  height:78px;
  ...
```

- [ ] **Step 6: Testin geçtiğini gör**

Run: `node tests/run.js`
Expected: PASS, toplam 395 geçen.

- [ ] **Step 7: Görsel doğrula**

Run: `python tests/gorsel.py`
Expected: `sera kutusu=44px` her genişlikte; yatay taşma 0px. Etiket kırpılması HÂLÂ raporlanır (Task 3'te çözülecek) — bu beklenen.

- [ ] **Step 8: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "kroki: sera kutusu eşit 44px, genişlik artık kapasiteden türemiyor

200 dizilik sera 17px kalıyor ve etiketi ekranda '8.' görünüyordu. 360px'te
ölçüldü: eşit 44px yoğunluğu değiştirmiyor (148 sera yine 25 satır) ve v88'de
belirlenen 44px dokunma hedefini ilk kez karşılıyor.

UNITE_KAPASITE ve UNITE_PX söküldü; tek kullanım yerleri bu hesaptı."
```

---

### Task 3: Etiket kırılması — kelime ortasından bölme yok

**Files:**
- Modify: `scv-saha-v1.html` — `.sera-box .label` (821), `.tarla-box .name` (924)

- [ ] **Step 1: Sera etiketini iki satıra izin verecek şekilde değiştir**

`.sera-box .label` kuralında `white-space:nowrap;` ve `text-overflow:ellipsis;` kaldırılır, yerine:

```css
/* İki satıra kadar sarılır (kutu 64-78px yüksek, yer var). Kelime ORTASINDAN
   bölünmez: "100cm" bir kere "100c / m" diye bölünmüştü ve okunmuyordu.
   Boşluklu adlar boşluktan iner ("80 cm"), boşluksuz uzun adlar tek kademe
   küçülüp tek satırda kalır. */
.sera-box .label{
  position:absolute;top:50%;left:0;right:0;
  transform:translateY(-50%);
  text-align:center;font-size:11px;font-weight:700;color:var(--ink);
  z-index:3;text-shadow:0 1px 3px var(--metin-halo),0 0 4px var(--metin-halo);
  padding:0 3px;
  overflow:hidden;
  overflow-wrap:normal;
  word-break:keep-all;
  hyphens:none;
  line-height:1.1;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
}
.sera-box .label.uzun-ad{font-size:9.5px;letter-spacing:-.02em;}
```

`9.5px` 12px tabanın altında; `:root`'taki kroki istisnası notuna bu değer de eklenir (kroki kutucukları zaten belgeli istisna kümesinde).

- [ ] **Step 2: Uzun adı işaretleyen mantığı `renderSeralar`'a ekle**

Boşluksuz ve 4 karakterden uzun adlar tek satırda sığmaz; onlara küçük punto verilir:

```js
    const uzunAd = !/\s/.test(s.ad||'') && (s.ad||'').length > 4;
```

ve etiket satırı:

```js
      <div class="label${uzunAd?' uzun-ad':''}">${escapeHtml(s.ad)}</div>
```

- [ ] **Step 3: Tarla adına aynı kuralı uygula**

`.tarla-box .name` kuralındaki `white-space:nowrap` kaldırılır, `-webkit-line-clamp:2` eklenir (aynı gerekçe yorumu, "T2 Yol Üstü" örneğiyle).

- [ ] **Step 4: Görsel doğrula — kırpılma SIFIRA inmeli**

Run: `python tests/gorsel.py`
Expected: PASS (çıkış kodu 0), `kırpılan=yok` her satırda, yatay taşma 0px.

- [ ] **Step 5: Testler**

Run: `node tests/run.js`
Expected: PASS, 395.

- [ ] **Step 6: Commit**

```bash
git add scv-saha-v1.html
git commit -m "kroki: etiketler kelime ortasından bölünmüyor, iki satıra sarılıyor

100cm etiketi '100c / m' diye bölünüyordu. Boşluklu adlar boşluktan iniyor,
boşluksuz uzun adlar tek kademe küçülüyor. T2 Yol Üstü de bu kuralla sığdı."
```

---

### Task 4: Hareket belirteçleri ve tek reduced-motion bloğu

**Files:**
- Modify: `scv-saha-v1.html` — `:root` (207'den önce), reduced-motion blokları (726, 1030, 1585)

**Interfaces:**
- Produces: `--gecis-hizli`, `--gecis-orta`, `--gecis-yavas`, `--egri-yumusak`, `--egri-cikis`. Sonraki görevler bunları kullanır.

- [ ] **Step 1: Belirteçleri ekle**

`:root` bloğunun sonuna, `--shadow-lg` satırından sonra (`scv-saha-v1.html:205` civarı):

```css
  /* --- HAREKET ÖLÇEĞİ ---
     Renk, tipografi (v90-v93) ve yarıçap (v94) için ölçek vardı; hareket için
     yoktu ve 6 geçiş + 13 animasyon elle yazılmıştı. Süreler kısa tutuldu:
     sahada güneş altında bekleyen bir arayüz hızlı olmalı. */
  --gecis-hizli:120ms;   /* basılı hâl, vurgulama */
  --gecis-orta:220ms;    /* modal, panel, kart */
  --gecis-yavas:420ms;   /* senkron vurgusunun sönümü */
  --egri-yumusak:cubic-bezier(.4,0,.2,1);
  --egri-cikis:cubic-bezier(.2,0,0,1);
```

- [ ] **Step 2: Üç reduced-motion bloğunu tek bloğa indir**

`scv-saha-v1.html:726`, `1030` ve `1585` satırlarındaki üç `@media (prefers-reduced-motion…)` bloğunun içerikleri birleştirilir; üçü silinip `<style>` sonuna (yardımcı sınıflardan sonra) tek blok yazılır:

```css
/* ---------- HAREKET TERCİHİ ----------
   Tek yerde toplandı: eskiden üç ayrı blokta (satır 726/1030/1585) parça parça
   duruyordu ve yeni animasyon eklerken hangisine yazılacağı belirsizdi.
   Sahada hareket yardımcıdır ama tercih eden kullanıcı için hepsi kapanır —
   bilgi kaybı olmaz, çünkü renk ve konum anlamı zaten taşıyor. */
@media (prefers-reduced-motion: reduce){
  .plan-tuval.plan-bugun .plan-konektor path{animation:none;stroke-dasharray:none;}
  .plan-kart.hedef{animation:none;box-shadow:0 0 0 3px var(--green-100),var(--shadow);}
  .plan-cip-kilit{animation:none;}
  .plan-cip-sera .cubuk{transition:none;}
  .tarla-box.calisma-isaretli,.sera-box.calisma-isaretli,
  .calisma-serit-kutu,.calisma-bant b{animation:none;}
  .sync-status.saving .dot,.sync-status.depo-dolu .dot{animation:none;}
}
```

Not: bu adımda taşınan kurallar bire bir aynı kalmalı; eklemeler sonraki görevlerde bu bloğa yapılacak.

- [ ] **Step 3: Belirteçlerin çözüldüğünü doğrula**

Run:
```bash
python - <<'PY'
import pathlib
from playwright.sync_api import sync_playwright
KOK = pathlib.Path("scv-saha-v1.html").resolve()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto(KOK.as_uri()); pg.wait_for_timeout(1500)
    r = pg.evaluate("""()=>{const s=getComputedStyle(document.documentElement);
      return ['--gecis-hizli','--gecis-orta','--gecis-yavas','--egri-yumusak','--egri-cikis']
        .map(k=>k+'='+s.getPropertyValue(k).trim());}""")
    print("\n".join(r)); b.close()
PY
```
Expected: beş satırın hepsi dolu (`--gecis-hizli=120ms` vb.), hiçbiri boş değil.

- [ ] **Step 4: Testler**

Run: `node tests/run.js`
Expected: PASS, 395.

- [ ] **Step 5: Commit**

```bash
git add scv-saha-v1.html
git commit -m "hareket ölçeği: belirteçler eklendi, reduced-motion tek bloğa indi

Renk, tipografi ve yarıçap için ölçek vardı, hareket için yoktu. Üç ayrı
prefers-reduced-motion bloğu (726/1030/1585) birleştirildi."
```

---

### Task 5: Izgaradaki × kalkar, uzun basma gelir

Bu görevin deliverable'ı en büyüğü; silme akışının kendisi değişmiyor, yalnızca tetikleyicisi.

**Files:**
- Modify: `scv-saha-v1.html` — `.sera-close`/`.tarla-close` CSS (849, 984), `renderSeralar` (4651), `renderTarlalar` (4709), yeni JS bölümü
- Test: `tests/run.js`

**Interfaces:**
- Consumes: Task 4'ün `--gecis-*` belirteçleri.
- Produces: `uzunBasmaBaslat(el, calistir)`, `uzunBasmaIptal()`, `uzunBasmaTiklamaYutuldu() -> boolean`, sabit `UZUN_BASMA_MS = 500`.

- [ ] **Step 1: Uzun basma davranışının testini yaz**

`tests/run.js`'e ekle:

```js
  bolum('Kroki — uzun basma ile silme');
  {
    const app = kur();
    const sahteEl = { classList:{ _k:new Set(),
      add(c){this._k.add(c);}, remove(c){this._k.delete(c);}, contains(c){return this._k.has(c);} } };

    // Süre dolmadan bırakılırsa çalışmaz
    let calisti = 0;
    app.uzunBasmaBaslat(sahteEl, ()=>calisti++);
    dogru(sahteEl.classList.contains('uzun-basiliyor'), 'basarken ilerleme sınıfı eklenir');
    app.uzunBasmaIptal();
    yanlis(sahteEl.classList.contains('uzun-basiliyor'), 'bırakınca sınıf kalkar');
    esit(calisti, 0, 'süre dolmadan silme çalışmaz');
    yanlis(app.uzunBasmaTiklamaYutuldu(), 'iptal edilen basma tıklamayı yutmaz');
    app._temizle();
  }
  {
    const app = kur();
    const sahteEl = { classList:{ _k:new Set(),
      add(c){this._k.add(c);}, remove(c){this._k.delete(c);}, contains(c){return this._k.has(c);} } };
    let calisti = 0;
    app.uzunBasmaBaslat(sahteEl, ()=>calisti++);
    // tests/run.js bir async IIFE (satır 313) — harness GERÇEK zamanlayıcı
    // kullanıyor, o yüzden gerçekten bekliyoruz. Tek seferlik ~530ms, 393 testin
    // dayandığı zamanlayıcı davranışına dokunmaktan ucuz.
    await new Promise(r=>setTimeout(r, app.UZUN_BASMA_MS + 30));
    esit(calisti, 1, 'süre dolunca silme çalışır');
    yanlis(sahteEl.classList.contains('uzun-basiliyor'), 'tetiklenince ilerleme sınıfı kalkar');
    dogru(app.uzunBasmaTiklamaYutuldu(), 'tetiklenen basma takip eden tıklamayı yutar');
    yanlis(app.uzunBasmaTiklamaYutuldu(), 'yutma tek seferliktir');
    app._temizle();
  }
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.uzunBasmaBaslat is not a function`

- [ ] **Step 3: Uzun basma mantığını yaz**

`scv-saha-v1.html`'de `renderTarlalar`'dan sonra, yeni bölüm olarak:

```js
/* =========================================================
   UZUN BASMA İLE SİLME
   Izgaradaki × düğmeleri kaldırıldı: 148 sera ve onlarca tarla kutusunun her
   birinde duran yıkıcı bir eylem, tozlu elle ve tek parmakla kullanılan bir
   uygulamada yanlış dokunmaya fazla açıktı. Silme artık basılı tutmayı ister.

   Erişilebilir yol GERİLEMEDİ: silme zaten detay modalinde btn-danger olarak
   duruyor; ızgaradaki × yedek bir kısayoldu. Klavye ve ekran okuyucu oradan gider.

   Jest görünmezse keşfedilemez — bu yüzden basarken kutunun kenarında bir
   ilerleme dolar (.uzun-basiliyor). Buradaki hareket süs değil, öğretici.
   ========================================================= */
const UZUN_BASMA_MS = 500;
let uzunBasmaSayac = null;
let uzunBasmaEl = null;
let uzunBasmaTetiklendi = false;

function uzunBasmaBaslat(el, calistir){
  uzunBasmaIptal();
  uzunBasmaTetiklendi = false;
  uzunBasmaEl = el;
  if(el && el.classList) el.classList.add('uzun-basiliyor');
  uzunBasmaSayac = setTimeout(()=>{
    uzunBasmaTetiklendi = true;
    uzunBasmaIptal();
    calistir();
  }, UZUN_BASMA_MS);
}
function uzunBasmaIptal(){
  if(uzunBasmaSayac){ clearTimeout(uzunBasmaSayac); uzunBasmaSayac = null; }
  if(uzunBasmaEl && uzunBasmaEl.classList){ uzunBasmaEl.classList.remove('uzun-basiliyor'); }
  uzunBasmaEl = null;
}
/* Uzun basma tetiklendiyse takip eden click YUTULUR; yoksa silme onayının
   arkasında detay modali de açılır. Tek seferlik: bir sonraki tıklama normaldir. */
function uzunBasmaTiklamaYutuldu(){
  if(!uzunBasmaTetiklendi) return false;
  uzunBasmaTetiklendi = false;
  return true;
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `node tests/run.js`
Expected: PASS, 402 geçen.

- [ ] **Step 5: Kutulara bağla, × üretimini kaldır**

`renderSeralar` içindeki kutu şablonu — `<button class="sera-close" …>` satırı **silinir**, kapsayıcıya olay bağlanır:

```js
    return `<div class="sera-box${seritMetni?' calisma-isaretli':''}"
      onpointerdown="uzunBasmaBaslat(this, ()=>seraSil('${s.id}'))"
      onpointerup="uzunBasmaIptal()" onpointerleave="uzunBasmaIptal()"
      onpointercancel="uzunBasmaIptal()"
      onclick="if(!uzunBasmaTiklamaYutuldu()) openSeraDetay('${s.id}')">
```

`renderTarlalar` içinde aynısı, `<button class="tarla-close" …>` silinir:

```js
    return `<div class="tarla-box${kirimYapiliyor?' calisma-isaretli':''}"
      onpointerdown="uzunBasmaBaslat(this, ()=>tarlaSil('${t.id}'))"
      onpointerup="uzunBasmaIptal()" onpointerleave="uzunBasmaIptal()"
      onpointercancel="uzunBasmaIptal()"
      onclick="if(!uzunBasmaTiklamaYutuldu()) openTarlaDetay('${t.id}')">
```

- [ ] **Step 6: `.sera-close` / `.tarla-close` CSS'ini sil, ilerleme göstergesini ekle**

İki kural (`scv-saha-v1.html:849` ve `984`) tamamen silinir. Yerine:

```css
/* Basılı tutarken dolan ilerleme. Kutunun ALT kenarında ince bir şerit:
   içeriğin üstünü kapatmıyor ve dolum yönü "devam ediyor" hissini veriyor. */
.sera-box,.tarla-box{
  -webkit-touch-callout:none;
  -webkit-user-select:none;user-select:none;
  touch-action:manipulation;
}
.sera-box::before,.tarla-box::before{
  content:"";position:absolute;left:0;bottom:0;height:3px;width:0;
  background:var(--red);z-index:7;border-radius:0 var(--r-xs) 0 0;
  pointer-events:none;
}
.sera-box.uzun-basiliyor::before,.tarla-box.uzun-basiliyor::before{
  width:100%;
  transition:width var(--uzun-basma-sure) linear;
}
```

`:root`'a süre belirteci eklenir (JS sabitiyle aynı değer, iki yerde yazılmasın diye yorumla bağlanır):

```css
  /* JS'teki UZUN_BASMA_MS ile AYNI olmalı — ilerleme göstergesi tam o anda dolar. */
  --uzun-basma-sure:500ms;
```

Reduced-motion bloğuna eklenir:

```css
  /* İlerleme kaybolmaz, yalnızca anında dolar: jestin geri bildirimi kalmalı. */
  .sera-box.uzun-basiliyor::before,.tarla-box.uzun-basiliyor::before{transition:none;}
```

- [ ] **Step 7: Görsel doğrula**

Run: `python tests/gorsel.py`
Expected: PASS; ekran görüntülerinde kutuların üstünde × düğmesi görünmemeli.

- [ ] **Step 8: Commit**

```bash
git add scv-saha-v1.html tests/run.js tests/harness.js
git commit -m "kroki: ızgaradaki × kalktı, silme uzun basmaya taşındı

148 sera kutusunun her birinde duran yıkıcı bir eylem, tozlu elle tek parmak
kullanımda yanlış dokunmaya açıktı. Erişilebilir yol gerilemedi: silme zaten
detay modalinde duruyor. Basarken alt kenarda ilerleme dolar, yoksa jest
keşfedilemezdi."
```

---

### Task 6: Senkron vurgusu — başkası neyi değiştirdi

**Files:**
- Modify: `scv-saha-v1.html` — `baglamFirestoreDinleyici` (3141 civarı), `renderSeralar`, `renderTarlalar`, CSS
- Test: `tests/run.js`

**Interfaces:**
- Consumes: Task 4'ün `--gecis-yavas`.
- Produces: `degisimIsaretle(idler) -> boolean`, `degisimSinifi(id) -> string`, sabitler `VURGU_SURE_MS = 3000`, `VURGU_EN_COK = 12`.

- [ ] **Step 1: Testi yaz**

```js
  bolum('Senkron vurgusu');
  {
    const app = kur();
    dogru(app.degisimIsaretle(['a','b']), 'az sayıda değişim işaretlenir');
    esit(app.degisimSinifi('a'), ' yeni-degisti', 'işaretli kayıt sınıf alır');
    esit(app.degisimSinifi('c'), '', 'işaretsiz kayıt sınıf almaz');

    // Toplu değişim (içe aktarma/yedek geri yükleme) tek tek vurgulanmaz
    const cok = Array.from({length: app.VURGU_EN_COK + 1}, (_,i)=>'x'+i);
    yanlis(app.degisimIsaretle(cok), 'eşiği aşan toplu değişim işaretlenmez');
    esit(app.degisimSinifi('x0'), '', 'toplu değişimde tek tek vurgu yok');

    yanlis(app.degisimIsaretle([]), 'boş liste işaretlenmez');
    app._temizle();
  }
  {
    // Süre aşımı beklemeden sınanır: degisimTaze zamanı parametre olarak alıyor.
    const app = kur();
    app.degisimIsaretle(['a']);
    dogru(app.degisimTaze('a', Date.now()), 'taze vurgu ayakta');
    yanlis(app.degisimTaze('a', Date.now() + app.VURGU_SURE_MS + 100), 'süresi dolan vurgu düşer');
    esit(app.degisimSinifi('a'), '', 'süresi dolan kayıt artık sınıf almaz');
    app._temizle();
  }
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `node tests/run.js`
Expected: FAIL — `app.degisimIsaretle is not a function`

- [ ] **Step 3: Mantığı yaz**

`scv-saha-v1.html`'de `scheduleRenderAll`'dan sonra:

```js
/* =========================================================
   UZAKTAN GELEN DEĞİŞİMİN İZİ
   Çok kullanıcılı sahada "başkası neyi değiştirdi" sorusunun cevabı yoktu:
   ekran sessizce güncelleniyordu. baglamFirestoreDinleyici zaten uzak değişim
   listesini hesaplıyor (docChanges + hasPendingWrites ile kendi yazdıklarımız
   eleniyor); o id'ler burada kısa süre tutulur, render sırasında işaretlenir.

   EŞİK neden var: içe aktarma ya da yedek geri yükleme yüzlerce kaydı aynı anda
   değiştirir. 148 kutunun birden yanması bilgi değil gürültüdür — o bir VERİ
   olayıdır, saha olayı değil. Eşik aşılırsa hiç vurgulanmaz.
   ========================================================= */
const VURGU_SURE_MS = 3000;
const VURGU_EN_COK = 12;
const degisenKayitlar = new Map(); // id -> işaretlenme anı

function degisimIsaretle(idler){
  if(!idler || !idler.length || idler.length > VURGU_EN_COK) return false;
  const simdi = Date.now();
  idler.forEach(id=>degisenKayitlar.set(id, simdi));
  return true;
}
/* `simdi` parametre: süre aşımı testte beklemeden sınanabilsin diye. */
function degisimTaze(id, simdi){
  const t = degisenKayitlar.get(id);
  if(t===undefined) return false;
  if((simdi===undefined ? Date.now() : simdi) - t > VURGU_SURE_MS){
    degisenKayitlar.delete(id);
    return false;
  }
  return true;
}
function degisimSinifi(id){ return degisimTaze(id) ? ' yeni-degisti' : ''; }
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `node tests/run.js`
Expected: PASS, 409 geçen.

- [ ] **Step 5: Dinleyiciye bağla**

`baglamFirestoreDinleyici` içindeki `snap.docChanges().forEach(...)` döngüsünde değişen id'ler toplanır. Döngüden önce `const uzakDegisenler = [];`, döngü içinde her uygulanan değişiklikte `uzakDegisenler.push(id);`, `if(degisti){ … }` bloğunun içinde `stateNormalizeEt()` çağrısından sonra:

```js
        degisimIsaretle(uzakDegisenler);
```

- [ ] **Step 6: Kutulara sınıfı bas**

`renderSeralar`: `<div class="sera-box${seritMetni?' calisma-isaretli':''}${degisimSinifi(s.id)}"`
`renderTarlalar`: `<div class="tarla-box${kirimYapiliyor?' calisma-isaretli':''}${degisimSinifi(t.id)}"`

- [ ] **Step 7: CSS**

```css
/* Uzaktan gelen değişim. Animasyon YALNIZCA bu sınıfta tanımlı — renderAll
   innerHTML'i baştan kurduğu için, sınıfsız öğeye yazılmış bir animasyon her
   senkron turunda yeniden ateşlenir ve kutular sürekli yanıp sönerdi. */
@keyframes yeniDegistiSonum{
  from{box-shadow:0 0 0 2px var(--green-500),var(--shadow);}
  to{box-shadow:0 0 0 0 transparent,var(--shadow);}
}
.sera-box.yeni-degisti,.tarla-box.yeni-degisti{
  animation:yeniDegistiSonum var(--gecis-yavas) var(--egri-cikis) forwards;
}
```

Reduced-motion bloğuna: `.sera-box.yeni-degisti,.tarla-box.yeni-degisti{animation:none;}`

- [ ] **Step 8: Testler + görsel**

Run: `node tests/run.js && python tests/gorsel.py`
Expected: ikisi de PASS.

- [ ] **Step 9: Commit**

```bash
git add scv-saha-v1.html tests/run.js
git commit -m "senkron vurgusu: başka cihazdan gelen değişim kısa süre işaretlenir

docChanges zaten uzak değişim listesini veriyordu (hasPendingWrites kendi
yazdıklarımızı eliyor). 12 kaydı aşan toplu değişimlerde vurgu yapılmaz:
içe aktarma bir veri olayıdır, 148 kutunun yanması gürültü olurdu.

Animasyon yalnızca .yeni-degisti sınıfında tanımlı — renderAll innerHTML'i
baştan kurduğu için sınıfsız öğede her turda yeniden ateşlenirdi."
```

---

### Task 7: Cila — basılı hâl, modal, sekme yönü, kart yüksekliği

**Files:**
- Modify: `scv-saha-v1.html` — CSS (`.btn`, `.sera-box`, `.tarla-box`, `#overlay`, `.modal`, `.page`, `.plan-kart`)

- [ ] **Step 1: Dokunma basılı hâli**

```css
/* Dokunulan şeyin dokunulduğu görünmeli; sahada eldivenli/tozlu parmakla
   basıldığında geri bildirim yoksa kullanıcı iki kez basıyor. */
.btn,.icon-btn,.sera-box,.tarla-box,.tarla-tile,.plan-cip{
  transition:transform var(--gecis-hizli) var(--egri-yumusak),
             filter var(--gecis-hizli) var(--egri-yumusak);
}
.btn:active,.icon-btn:active,.tarla-tile:active,.plan-cip:active{
  transform:scale(.97);filter:brightness(.96);
}
/* Kroki kutularında ölçek DEĞİL parlaklık: 44px kutu küçülünce parmak altında
   kayboluyor gibi duruyor. */
.sera-box:active,.tarla-box:active{filter:brightness(.94);}
```

- [ ] **Step 2: Modal açılış/kapanış**

**Önce engeli kaldır.** `scv-saha-v1.html:1134`'teki `.overlay.hidden{display:none;}`
geçişi imkânsız kılıyor (`display` animasyonlanmaz) ve genel `.hidden{display:none;}`
(satır 1089) de aynı öğeye vuruyor. Kural şuna çevrilir — seçici `.overlay.hidden`
olduğu için özgüllüğü (0,2,0) genel `.hidden` kuralını (0,1,0) yener:

```css
/* display:none idi; geçiş animasyonlanamıyordu. visibility + pointer-events
   aynı işi görür (odak almaz, tıklama geçmez) ama solma mümkün olur. */
.overlay.hidden{
  display:flex;
  visibility:hidden;
  opacity:0;
  pointer-events:none;
}
```

Sonra geçişler:

```css
/* Modal şu an anlık beliriyor; nereden geldiği anlaşılmıyor. */
.overlay{transition:opacity var(--gecis-orta) var(--egri-yumusak),
                    visibility 0s linear 0s;}
.overlay.hidden{transition:opacity var(--gecis-orta) var(--egri-yumusak),
                           visibility 0s linear var(--gecis-orta);}
.modal{transition:transform var(--gecis-orta) var(--egri-cikis),
                  opacity var(--gecis-orta) var(--egri-cikis);}
.overlay.hidden .modal{transform:translateY(8px);opacity:0;}
```

`visibility`'nin gecikmesi kapanışta geçiş bitene kadar öğeyi görünür tutar;
açılışta gecikme yok. Modal kabı `#modalContent` değil `.modal` sınıfı üzerinden
hedeflenir (`scv-saha-v1.html:1135`).

- [ ] **Step 3: Sekme geçişinde yön hissi**

```css
/* Sayfa değişiminde içerik hafifçe yerine oturur: hangi ekrana geldiğin
   anlaşılsın diye. Kaydırma DEĞİL, yalnızca kısa bir yerleşme. */
.page:not(.hidden){animation:sayfaYerles var(--gecis-orta) var(--egri-cikis);}
@keyframes sayfaYerles{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
```

- [ ] **Step 4: Saha Planlama kartı açılırken yükseklik**

```css
.plan-kart{transition:box-shadow var(--gecis-orta) var(--egri-yumusak);}
.plan-kart.acik{box-shadow:var(--shadow-lg);}
```

- [ ] **Step 5: Reduced-motion bloğuna hepsini ekle**

```css
  .btn,.icon-btn,.sera-box,.tarla-box,.tarla-tile,.plan-cip{transition:none;}
  .btn:active,.icon-btn:active,.tarla-tile:active,.plan-cip:active{transform:none;}
  #overlay,#modalContent,.plan-kart{transition:none;}
  .page:not(.hidden){animation:none;}
```

- [ ] **Step 6: Doğrula**

Run: `node tests/run.js && python tests/gorsel.py`
Expected: ikisi de PASS. Ek olarak modalin açıldığını gözle doğrula: `tests/gorsel.py` çıktısındaki ekran görüntülerinde düzen bozulmamalı.

- [ ] **Step 7: Commit**

```bash
git add scv-saha-v1.html
git commit -m "cila: basılı hâl, modal geçişi, sayfa yerleşmesi, kart yüksekliği

Hepsi hareket belirteçlerinden besleniyor ve tek reduced-motion bloğunda
kapanıyor. Kroki kutularında ölçek yerine parlaklık: 44px kutu küçülünce
parmak altında kayboluyor gibi duruyordu."
```

---

### Task 8: Saha Planlama ölçeğe oturur, üst şerit kırpılması

**Files:**
- Modify: `scv-saha-v1.html` — plan modülü CSS, rozet şeridi CSS

- [ ] **Step 1: Sekiz değeri belirtece bağla**

| Seçici | Şu an | Hedef |
| --- | --- | --- |
| `.plan-alan-rozet` | `font-size:10px` | `var(--fs-xs)` |
| `.plan-alan-kirim` | `font-size:9px` | `var(--fs-xs)` |
| `.plan-detay-etiket` | `font-size:10px` | `var(--fs-xs)` |
| `.plan-sera-tile .pct` | `font-size:10px` | `var(--fs-xs)` |
| `.plan-cip .cogalt,.plan-cip .kaldir` | `font-size:12px` | `var(--fs-xs)` |
| `.dizim-plot-ic` | `font-size:18px` | `var(--fs-lg)` |
| `.dizim-del` | `font-size:15px` | `var(--fs-md)` |
| `.plan-cip .cogalt,.plan-cip .kaldir` | `border-radius:3px` | `var(--r-xs)` |

Son üçü zaten ölçek değerinde; yalnızca belirtece bağlanıyor, fiziksel boyut değişmiyor.

- [ ] **Step 2: 360px'te düzenin bozulmadığını doğrula**

İlk dört değer 12px tabana çıktığı için BÜYÜYOR. Plan sekmesini açıp render et:

```bash
python - <<'PY'
import json, pathlib
from playwright.sync_api import sync_playwright
KOK = pathlib.Path("scv-saha-v1.html").resolve()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width":360,"height":740}, device_scale_factor=2, is_mobile=True)
    pg.goto(KOK.as_uri()); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{document.getElementById('loginOverlay').classList.add('hidden');
      if(typeof dizimAlanlariTohumla==='function') dizimAlanlariTohumla();
      if(typeof sahaGenelSekmeGecis==='function') sahaGenelSekmeGecis('planlama');}""")
    pg.wait_for_timeout(800)
    print("yatay tasma:", pg.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth"))
    pg.screenshot(path="tests/_gorsel/plan-360.png", full_page=True)
    b.close()
PY
```
Expected: `yatay tasma: 0`. Ekran görüntüsünde plan kartları üst üste binmemeli, rozetler kutulardan taşmamalı.

**Düzen bozulduysa:** değeri geri alma; `:root`'ta kroki istisnası gibi belgeli istisna aç ve gerekçesini yaz. Sessizce eski hâlde bırakma.

- [ ] **Step 3: Üst şerit kırpılmasını düzelt**

"Sera Doluluk" rozeti dar ekranda "Sera Dolul" olarak kesiliyor. `#badgesRow` şeridine yatay kaydırma verilir:

```css
/* Rozetler dar ekranda kırpılıyordu ("Sera Dolul"). Şerit kendi içinde kayar;
   sayfa gövdesi yatay kaymaz. */
#badgesRow{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
#badgesRow::-webkit-scrollbar{display:none;}
#badgesRow .badge{flex:0 0 auto;}
```

- [ ] **Step 4: Doğrula**

Run: `node tests/run.js && python tests/gorsel.py`
Expected: ikisi de PASS, yatay taşma 0px.

- [ ] **Step 5: Commit**

```bash
git add scv-saha-v1.html
git commit -m "saha planlama ölçeğe oturdu; üst şerit rozetleri kırpılmıyor

Modül v95 tasarım turundan sonra eklendiği için ölçek dışı kalmıştı: 7 punto
ve 1 yarıçap elle yazılıydı, dördü 12px tabanın altındaydı. Rozet şeridi
artık kendi içinde kayıyor."
```

---

### Task 9: Kapanış — hafızayı ve belgeyi güncelle

- [ ] **Step 1: Tam doğrulama**

Run: `node tests/run.js && python tests/gorsel.py`
Expected: testler PASS, görsel PASS (taşma yok, kırpılma yok, sera kutusu 44px).

- [ ] **Step 2: Spec'i "uygulandı" olarak işaretle**

`docs/superpowers/specs/2026-08-09-kroki-ve-hareket-katmani-design.md` başındaki `Durum:` satırı güncellenir; düzen bozulması yüzünden istisna açıldıysa hangi değerler ve neden, spec'e eklenir.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-09-kroki-ve-hareket-katmani-design.md
git commit -m "spec: kroki ve hareket katmanı uygulandı olarak işaretlendi"
```

## Öz-denetim notları

**Spec kapsaması:** Bölüm 1 → Task 2/3/5. Bölüm 2 → Task 4/6/7. Bölüm 3 → Task 8. Doğrulama bölümü → Task 1 (araç) + her görevin son adımı. Kapsam dışı bırakılan doluluk animasyonu için görev yok — doğru.

**Denetimde düzeltilen üç şey** (ilk taslakta yanlıştı, doğrulandı ve düzeltildi):

1. Testler `app._zamanIlerlet()` çağırıyordu — harness'ta öyle bir şey yok, gerçek
   zamanlayıcı kullanıyor (`tests/harness.js:311`). `tests/run.js` zaten `async`
   IIFE (satır 313), bu yüzden uzun basma testi gerçekten bekliyor; harness'a
   dokunulmuyor. 393 testin dayandığı zamanlayıcı davranışını değiştirmek
   gereksiz risk olurdu.
2. Vurgu süre aşımı testi de zaman ilerletmeye bağlıydı. `degisimTaze(id, simdi)`
   zamanı parametre alacak şekilde tasarlandı; test beklemeden koşuyor.
3. Modal geçişi `#overlay.hidden{opacity:0}` varsayıyordu. Gerçekte
   `.overlay.hidden{display:none;}` (satır 1134) var ve `display` animasyonlanmaz —
   geçiş sessizce hiç çalışmazdı. Kural `visibility`+`opacity`+`pointer-events`
   üçlüsüne çevriliyor, kapanışta `visibility` gecikmeli. Seçiciler doğrulandı:
   `#overlay` sınıfı `.overlay`, `#modalContent` sınıfı `.modal` (satır 2326-2327).

**Sıra bağımlılığı:** Task 1 → hepsi (doğrulama aracı). Task 4 → Task 5/6/7 (belirteçler). Task 2 → Task 3 (genişlik sabitlenmeden kırılma ölçülemez).

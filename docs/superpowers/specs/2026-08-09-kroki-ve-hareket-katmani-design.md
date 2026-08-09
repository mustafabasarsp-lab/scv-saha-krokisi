# Kroki Kutuları ve Hareket Katmanı — Tasarım Şartnamesi

Tarih: 2026-08-09
Durum: **uygulandı** — `tasarim/kroki-hareket` dalı, v116–v123.
Plan: `docs/superpowers/plans/2026-08-09-kroki-ve-hareket-katmani.md`

## Uygulama sırasında değişenler

Üç şey şartnameden farklı sonuçlandı; hepsi ölçüme dayanıyor.

**1. Üst şerit düzeltmesi YAPILMADI — ortada hata yoktu.** Şartname
"'Sera Doluluk' dar ekranda kesiliyor" diyordu. Ölçüldüğünde `#badgesRow`'un
zaten `display:flex` + `overflow-x:auto` olduğu ve kaydırıldığı görüldü
(`scrollLeft` 0→195, son rozet tam görünür oluyor). Kısmi görünen rozet
kırpılma değil, kaydırma ipucunun kendisi. Denetimde ekran görüntüsü yanlış
okunmuş.

**2. `.plan-alan-kirim` (9px) ölçeğe çekilmedi, istisna olarak belgelendi.**
Bu bir metin değil, 15px'lik daire içindeki ✓ glifi; `:root`'taki "ikon/glif
ölçüleri" istisnasına giriyor. 12px'e çıkarılsa daireyi taşırırdı.

**3. Kapsama iki iş eklendi** (ikisi de render edilip görülünce ortaya çıktı,
kullanıcı onayıyla):

- *Tarla kutusunda esnek sıkışma.* Ad iki satıra inince dekar satırı 14.4px'ten
  1.7px'e eziliyor ve "23 da" sessizce kayboluyordu — v75'teki uyarı kutusu
  hatasının aynısı. `.name` ve `.sub` için `flex-shrink:0`, kutu `height` yerine
  `min-height`. Uzun adın olduğu satır 64→82px büyüyor, diğerleri 64px kalıyor.
- *Plan çipinde tarla adı.* Toplanmış kartta "K1" yerine "K." görünüyordu: 65px'lik
  çipin 21px'ini çoğalt düğmesi alıyor, ada 11px kalıyordu. Çoğalt düğmesi açık
  karta taşındı (kaldır zaten öyleydi). Bu kırpılma bu turdan ÖNCE de vardı,
  `git stash` ile doğrulandı.

## Doğrulama sonucu

- `node tests/run.js` → **434 geçiyor** (tur başında 393)
- `python tests/gorsel.py` → 360/390/430px × açık/koyu: yatay taşma 0px,
  kırpılan etiket yok, sera kutusu 44px
- Hareket: sade kutuda animasyon `none`, `.yeni-degisti` taşıyanda 0.42s,
  `prefers-reduced-motion` tercihinde hepsi kapanıyor (ölçüldü)

## Amaç

İki iş bir arada:

1. **Kroki kutularının okunurluğunu düzeltmek.** Sera kutusunun genişliği kapasiteden
   türediği için düşük kapasiteli seralar okunamayacak kadar inceliyor. Bu, sahada
   "hangi sera" sorusunu cevaplanamaz hâle getiriyor.
2. **Tasarım sistemine hareket katmanını eklemek.** Renk, tipografi (v90–v93) ve
   yarıçap (v94) için ölçek kurulmuş; hareket için yok. Mevcut 6 geçiş ve 13
   animasyon elle, dağınık yazılmış ve `prefers-reduced-motion` üç ayrı yerde
   tekrarlanıyor.

İkisi aynı turda, çünkü uzun basma jesti hem (1)'in parçası hem de (2)'siz
keşfedilemez.

## Ölçülen kanıt

360px genişlikte, gerçek CSS ve gerçek render ile (Playwright) ölçüldü.
Karşılaştırma: <https://claude.ai/code/artifact/9536a9d4-fa47-4a1a-a166-2a2681e557af>

Kök neden: `width = (kapasite / AYARLAR.UNITE_KAPASITE) × AYARLAR.UNITE_PX`
yani `(kapasite / 480) × 40px`.

| Sera | Kapasite | Kutu | Etiket ister | Yer var | Sonuç |
| --- | --- | --- | --- | --- | --- |
| `80 cm` | 200 | 17px | 39px | 15px | ekranda `8.` |
| `90cm` | 240 | 20px | 37px | 18px | ekranda `9..` |
| `100cm` | 400 | 33px | 44px | 31px | ekranda `1...` |
| `B1` | 400 | 33px | 31px | 31px | sıfır pay |

Son iki satır aynı kutu boyunda: sorun yalnızca kapasitesi düşük seralarda
değil, **adı uzun olan her serada** var. `B1` sığıyor çünkü adı kısa.

Punto düşürmek çözmüyor; sorun yazıda değil kabın genişliğinde.

Seçenek karşılaştırması (`seraPlot` iç genişliği 318px, `gap:10px`):

| Seçenek | Kutu | 148 sera | Dokunma hedefi | Taşan etiket |
| --- | --- | --- | --- | --- |
| Bugün | 17–40px | 25 satır | 33px — **altında** | 3 |
| Eşit 36px | 36px | 25 satır | 36px — altında | yok |
| **Eşit 44px** | **44px** | **25 satır** | **44px ✓** | **yok** |
| Eşit 64px | 64px | 37 satır | 64px ✓ | yok |

44px, bugünkü satır sayısını **değiştirmiyor**: okunurluk ve dokunma hedefi
bedelsiz geliyor. Ayrıca bugünkü 33px'lik normal kutuların da v88'de belirlenen
44px dokunma hedefinin altında olduğu bu ölçümde ortaya çıktı — o turda gözden
kaçmış bir erişilebilirlik açığı.

## Kapsam kararları

| Konu | Karar |
| --- | --- |
| Sera kutusu genişliği | Sabit 44px; kapasiteyi artık anlatmıyor |
| Kapasite bilgisi | Detay modalinde ve ipucunda yaşar; ızgarada doluluk yüzdesi tek sinyal |
| Tarla kutusu | 64×64 kalır; yalnızca × kalkar |
| Izgaradaki × düğmesi | Kaldırılır, yerine uzun basma (~500ms) |
| Erişilebilir silme yolu | Değişmez: kutuya dokun → detay → **Sil** (zaten vardı) |
| Hareket mimarisi | Belirteç tabanlı CSS ölçeği + ince JS dikişi |
| Izgarada giriş animasyonu | **Yok** — 148 kutunun belirmesi sahada takip edilemez |
| Doluluk çubuğu animasyonu | **Kapsam dışı** (gerekçe aşağıda) |

## Bölüm 1 — Kroki kutuları

### 1.1 Sera kutusu eşitlenir

`.sera-box` genişliği sabit **44px** olur (yükseklik zaten 64px). Satır içi
`style="width:…"` üretimi kalkar.

`AYARLAR.UNITE_KAPASITE` ve `AYARLAR.UNITE_PX` sabitleri **sökülür**: tek
kullanım yerleri bu hesaptı (doğrulandı — dosyada başka referans yok, testlerde
de yok). `AYARLAR.GUNLUK_ISLEME_DIZI` ayrı bir iş yapıyor (boşalma tahmini),
kalır. Gerekçe v90 dersinin aynısı: kullanılmayan belirteç süstür.

### 1.2 Etiket kırılması düzelir

`100cm` şu an `overflow-wrap:anywhere` yüzünden `100c / m` diye kelime
ortasından bölünüyor. Kural: **kelime ortasından bölme yok.** Boşluk içeren
adlar boşluktan iki satıra iner (`80 cm`, `T2 Yol Üstü`); boşluksuz uzun adlar
tek kademe punto düşüşüyle tek satırda kalır. Kutu 64px yüksek olduğu için iki
satır zaten sığıyor.

### 1.3 × kalkar, uzun basma gelir

- `.sera-close` ve `.tarla-close` ızgaradan kaldırılır (HTML üretimi + CSS).
- Kutuya ~500ms basılı tutmak mevcut `seraSil` / `tarlaSil` akışını çağırır.
  O akış değişmez: `onayla` + `silmeYedekAl` (geri alma) yerinde kalır.
- Basılı tutarken kutunun kenarında **dolan bir ilerleme göstergesi** çizilir.
  Bu hareket süs değil, zorunlu: görünmeyen bir jest keşfedilemez.
- Uzun basma tamamlandığında takip eden `click` bastırılır; yoksa silme onayının
  arkasında detay modali de açılır.
- Parmak kayarsa veya kaydırma jesti başlarsa uzun basma iptal olur.
- Klavye ve ekran okuyucu yolu değişmez ve **gerilemez**: silme zaten detay
  modalinde `btn-danger` olarak var. Izgaradaki × yedek bir yoldu.

## Bölüm 2 — Hareket katmanı

### 2.1 Belirteçler

`:root` içinde, yalnızca fiilen kullanılacak kadar:

| Belirteç | Değer | Nerede |
| --- | --- | --- |
| `--gecis-hizli` | 120ms | basılı hâl, vurgulama |
| `--gecis-orta` | 220ms | modal, panel, kart |
| `--gecis-yavas` | 420ms | senkron vurgusunun sönümü |
| `--egri-yumusak` | `cubic-bezier(.4,0,.2,1)` | genel |
| `--egri-cikis` | `cubic-bezier(.2,0,0,1)` | beliren öğeler (yavaşlayarak yerleşir) |

Üç ayrı `prefers-reduced-motion` bloğu (satır 726, 1030, 1585) **tek global
bloğa** indirilir.

### 2.2 Bilgi taşıyan hareket

**Senkron vurgusu.** Başka bir cihazdan gelen değişiklik, ilgili kutuyu/satırı
kısa süre işaretler ve söner. Kaynak hazır: `baglamFirestoreDinleyici` içindeki
`snap.docChanges()` zaten değişen belge id'lerini veriyor ve
`change.doc.metadata.hasPendingWrites` ile *kendi* yazdıklarımızı eliyor — yani
"başkası neyi değiştirdi" listesi bedavaya mevcut.

Değişen id'ler zaman damgasıyla bir kümede tutulur; render fonksiyonları HTML'i
kurarken eşleşen öğeye "değişti" sınıfını basar. Küme kendiliğinden süre aşımına
uğrar.

**Toplu değişim korkuluğu:** bir turda eşikten (öneri: 12) fazla kayıt
değiştiyse tek tek vurgulama yapılmaz. O bir veri olayıdır (içe aktarma, yedek
geri yükleme), saha olayı değil; 148 kutunun aynı anda yanması gürültüdür.

**Uzun basma ilerlemesi.** Bkz. 1.3.

### 2.3 Cila

- Dokunma basılı hâli (kroki kutuları + düğmeler)
- Modal açılış/kapanış geçişi (şu an anlık)
- Sekme geçişinde yön hissi
- Saha Planlama kartı açılırken yükseklik

### 2.4 Kritik teknik kural

`renderAll` innerHTML'i baştan kuruyor. Yeni oluşturulan bir düğüme yazılmış
`animation` **her render'da yeniden ateşlenir**; Firestore anlık görüntüleri
düzenli geldiği için kutular sürekli yanıp sönerdi.

**Kural: animasyon yalnızca "değişti" sınıfı taşıyan öğede tanımlıdır.**
Sınıfsız öğede hareket yoktur. Bu, 2.2'deki vurgunun da hem tetikleyicisi hem
sınırlayıcısıdır.

### 2.5 Bilerek kapsam dışı — doluluk çubuğu animasyonu

Element her render'da yeniden yaratıldığı için `transition`'ın kıyaslayacağı
önceki değer yok; çubuk yeni değerinde doğar, geçiş oluşmaz. Çalıştırmanın yolu
ya hedefli DOM güncellemesine geçmek ya da eski değeri ayrıca taşımaktır —
ikisi de kazandırdığından fazlasını götürür. Sonradan hedefli güncellemeye
geçilirse bu özellik bedavaya gelir.

## Bölüm 3 — Ölçek ve taşma düzeltmeleri

### 3.1 Saha Planlama ölçeğe oturur

Modül v95 tasarım turundan sonra eklendiği için ölçek dışı kaldı. Renk
disiplinine uyuyor (çıplak renk yok), ama:

| Seçici | Şu an | Hedef |
| --- | --- | --- |
| `.plan-alan-rozet` | 10px | `--fs-xs` (12px) |
| `.plan-alan-kirim` | 9px | `--fs-xs` (12px) |
| `.plan-detay-etiket` | 10px | `--fs-xs` (12px) |
| `.plan-sera-tile .pct` | 10px | `--fs-xs` (12px) |
| `.plan-cip .cogalt`, `.kaldir` | 12px | `--fs-xs` (12px) |
| `.dizim-plot-ic` | 18px | `--fs-lg` (18px) |
| `.dizim-del` | 15px | `--fs-md` (15px) |
| `.plan-cip .cogalt/.kaldir` yarıçap | 3px | `--r-xs` (6px) |

Son üç satır zaten ölçek değerinde; yalnızca belirtece bağlanıyorlar, fiziksel
boyut değişmiyor. İlk dördü 12px tabana çıkacağı için büyüyor.

**Uyarı:** 9–10px değerler 12px tabanın altında; ölçeğe çekilince fiziksel
olarak büyüyorlar. Kart düzenini bozup bozmadıkları 360px'te render edilerek
doğrulanacak. Bozuyorlarsa kroki kutuları gibi **belgeli istisna** olarak
`:root`'ta açılacaklar — sessizce bırakılmayacaklar.

### 3.2 Üst şerit kırpılması

Rozet şeridinde "Sera Doluluk" dar ekranda "Sera Dolul" olarak kesiliyor.
Şeridin dar ekran taşma davranışı düzeltilir.

### 3.3 Tarla adı taşması

"T2 Yol Üstü" 64px kutuya sığmıyor. 1.2'deki kırılma kuralı bunu da çözer
(boşluktan iki satıra iner).

## Doğrulama

- Her bölüm sonrası `node tests/run.js` (şu an 393 geçiyor).
- Davranış değişen her yer için harness testi: uzun basma silme akışı, senkron
  vurgusu kümesinin süre aşımı ve toplu değişim eşiği.
- **Görsel doğrulama artık mümkün:** Playwright ile 360 / 390 / 430px, açık ve
  koyu tema. Bu, projede v88'den beri açık duran doğrulama boşluğuydu
  (`resize_window` 627px altına inemiyordu).
- Yatay taşma her genişlikte 0px kalmalı (şu an 0px).

## Riskler

| Risk | Karşılık |
| --- | --- |
| Uzun basma keşfedilmez | İlerleme göstergesi jesti öğretir; detaydaki Sil düğmesi zaten duruyor |
| Uzun basma yanlışlıkla tetiklenir | Onay + `silmeYedekAl` geri alma zinciri değişmiyor |
| Kapasite bilgisi kaybolur | Detay modalinde ve ipucunda kalır; ızgarada zaten okunmuyordu |
| Senkron vurgusu gürültü yapar | 12 kayıt eşiği + yalnızca uzaktan değişimler |
| Animasyon her render'da tekrarlar | 2.4'teki kural: yalnızca "değişti" sınıfında animasyon |
| Plan puntoları büyüyünce düzen bozulur | 360px'te render ile doğrulama; gerekirse belgeli istisna |

## İlgili

- `project-scv-tasarim` (hafıza) — v69–v95 tasarım geçmişi, belirteç kuralı,
  koyu tema tuzakları, kroki kutularındaki bilerek korunan metafor farkı
  (`.tarla-box` arazi parseli / `.sera-box` dolan kap — bu fark korunur,
  değişen yalnızca genişlik)
- `docs/superpowers/specs/2026-08-04-saha-planlama-design.md`

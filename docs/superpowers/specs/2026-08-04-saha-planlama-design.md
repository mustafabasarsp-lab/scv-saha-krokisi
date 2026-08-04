# Saha Planlama — Tasarım Şartnamesi

Tarih: 2026-08-04
Durum: onaylandı (kullanıcı onayı alındı, uygulama planı henüz yazılmadı)

## Amaç

Tütünün tarladan seraya ulaşana kadar izlediği yolu gün gün planlamak ve bu planı
şematik olarak göstermek. Sahadaki işleyiş şu:

1. Tütün tarlada kırılır.
2. Şoför bir araçla kırılan tütünü doğru **dizim alanına** indirir.
3. Dizim alanındaki dizim makinelerinde dizilir.
4. Dizilen tütün doğru **seralara** gönderilir.

Farklı çeşitteki (kod) tütünlerin birbirine karışmaması kritik. Şemanın ikinci
amacı devir kolaylığı: seralardan sorumlu kişi izindeyken diğer elemanlar planı
okuyup işi sürdürebilmeli.

## Kapsam kararları

| Konu | Karar |
| --- | --- |
| Dizim alanı | Sera gibi kalıcı, tanımlı varlık |
| "Kod" ne demek | Çeşit/varyete — tarlada zaten var, yeni alan gerekmez |
| Zaman kapsamı | Günlük plan; her günün kendi şeması, tarih seçicili |
| Kırım kayıtlarıyla ilişki | Plan önce kurulur, kırım kaydı plandan beslenir |
| Şema biçimi | Üç sütun (tarlalar / dizim alanları / seralar) + bağlantı çizgileri |
| Yerleşim | Saha Genel paneline iki sekme; Saha Planlama seçilince panel tam ekran |
| Şoför | Her gün değişir → planda serbest metin. Kalıcı olan **araç** |
| Dizim alanı bölme | Sahadaki karton ayrımının karşılığı; 1–4 bölme |

## Veri modeli

### Yeni koleksiyon: `dizimAlanlari`

Sera gibi kalıcı varlık. Sahada 8 alan var; adları seralarla çakışmasın diye
`D.` öneki ile saklanır (D.A1–D.A4, D.B1–D.B4).

```js
{ id, ad:'D.A1', bolge:'kalemli'|'tekeliler'|'', sira:1,
  olusturma, ...sonIslemDamgasi() }
```

Önek kararının gerekçesi ekran değil veri: yedek/dışa aktarma, arama, rapor ve
sözlü iletişimde ("A1'e indir" hangi A1?) tek harf bütün belirsizliği kaldırıyor.
Şemada kutu içinde büyük **A1**, altında küçük **DİZİM** rozeti gösterilir — yani
sahadaki tabelayla da örtüşür.

Alanların yönetimi: uygulama ilk açılışta liste boşsa 8 alanı (D.A1–D.A4,
D.B1–D.B4) kendiliğinden oluşturur. Şemanın altındaki `⚙ Dizim Alanları`
düğmesi ekle/adını değiştir/sil için küçük bir kip açar — sera yönetiminin
sadeleştirilmiş hâli. Bir alan silinirse geçmiş planlardaki atamaları da düşer;
silmeden önce kaç planda kullanıldığı gösterilir.

### Yeni koleksiyon: `sahaPlanlari`

Günde bir belge; belge id'si doğrudan tarih.

```js
{ id:'2026-08-05', tarih:'2026-08-05',
  alanlar:[
    { alanId:'…',
      bolmeler:[
        { id:'b1',
          girisler:[ { tarlaId:'…', aracId:'traktor1', sofor:'Ahmet' } ],
          seraIds:['…','…'],
          kirimId:null,   // kırım kaydına dönüşünce dolar
          not:'' }
      ] }
  ],
  olusturma, ...sonIslemDamgasi() }
```

Kurallar:

- Belge **tembel** oluşur: bir güne ilk atama yapılana kadar o günün belgesi
  yazılmaz. Boş günler için çöp belge birikmez.
- Bir alanın bölme sayısı 1–4. Varsayılan 1 (bölmesiz, sade hâl).
- Bir bölmenin **çeşidi saklanmaz**, içindeki tarlaların çeşidinden türetilir.
  Tek kaynak korunur; tarlanın çeşidi değişirse plan kendiliğinden doğrulanır.
- Bir tarla aynı planda birden fazla bölmeye bağlanabilir (farklı kırım kodları).
- Bir sera aynı planda yalnız bir bölmeye bağlanabilir; başka bölmeye eklenmek
  istenirse öncekinden taşınır ve kullanıcıya bilgi verilir.

### Araçlar — kodda sabit liste

Sahada 2 traktör + 2 transit var; şoförleri her gün değişiyor. Dört kalemlik bir
liste için ayrı koleksiyon, güvenlik kuralı ve yönetim ekranı israf olacağından
araçlar kod içinde sabit tanımlanır:

```js
const ARACLAR = [
  { id:'traktor1', ad:'Traktör 1', tip:'traktor', renk:'…' },
  { id:'traktor2', ad:'Traktör 2', tip:'traktor', renk:'…' },
  { id:'transit1', ad:'Transit 1', tip:'transit', renk:'…' },
  { id:'transit2', ad:'Transit 2', tip:'transit', renk:'…' }
];
```

Renkler koyu temada da okunur olacak şekilde mevcut belirteçlerden seçilir. Filo
değişirse tek satır eklenir.

### Şoför adı

Serbest metin. Yazım tutarlılığı için son 30 günün planlarında geçen adlar
`<datalist>` önerisi olarak sunulur.

### Firestore kuralları

`dizimAlanlari` ve `sahaPlanlari` `SYNC_KOLEKSIYONLARI` listesine eklenir. Aynı
adlar `firestore.rules` içindeki izinli koleksiyon listelerine de eklenmeli —
aksi hâlde pre-commit kancası commit'i durdurur. **Kural değişikliği Firebase
Console'dan elle publish edilmelidir.**

## Ekran

### Sekmeler

`Saha Genel` panelinin başlığına iki sekme gelir:

- **Genel Bilgiler** — bugünkü içerik olduğu gibi (kroki başlığı, doluluk
  göstergesi, hızlı istatistikler, uyarılar).
- **Saha Planlama** — yeni şema.

Saha Planlama seçilince panel mevcut `panelTamEkranAc('...')` mekanizmasıyla tam
ekrana açılır; şema geniş alanda çalışır. Genel Bilgiler'e dönünce panel yine dar
orta sütuna iner. Yeni sayfa/sekme eklenmez.

### Şema düzeni

```
┌ ‹ 5 Ağustos 2026 ›   [📋 Dünü Kopyala]  [⇄ Değiştir]  [× Seçimi bırak] ┐
│                                                                        │
│  TARLALAR            DİZİM ALANLARI              SERALAR              │
│                     ┌──────────────────┐                              │
│  ┌─────────┐        │ A1        DİZİM  │                              │
│  │ K11     │──┐     ├──────────────────┤    ┌────┐┌────┐┌────┐       │
│  │ BSB6195 │  ├─────┤ ① BSB 6195   ‹  │────│ D1 ││ D2 ││ D4 │  [+]  │
│  │ 61 da   │  │     │   2 tarla        │    │▓▓▓·││▓···││····│       │
│  └─────────┘  │     ├─ ─ karton ─ ─ ─ ─┤    │%78 ││%31 ││boş │       │
│  ┌─────────┐  │     │ ② PVH 2310   ‹  │────│    ││    ││    │       │
│  │ K21     │──┘     │   1 tarla        │    └────┘└────┘└────┘       │
│  │ BSB6195 │        └──────────────────┘        [⊞ Böl] [⊟ Birleştir] │
│  └─────────┘        ┌──────────────────┐                              │
│                     │ A2        DİZİM  │  ← boş, soluk                │
│  ╔═════════╗        ╔══════════════════╗    ┌────┐┌────┐              │
│  ║ K13     ║════════╣ B1        DİZİM  ║────│ C2 ││ C3 │        [+]  │
│  ║ PVH2310 ║        ║ ① PVH 2310   ‹  ║    └────┘└────┘              │
│  ╚═════════╝        ╚══════════════════╝                              │
│   ▲ seçili              ▲ seçili                                      │
│                                                                        │
│  [+ Tarla]                                    ⚠ D.A3, D.A4 boş        │
└────────────────────────────────────────────────────────────────────────┘
     Çizgi rengi = araç:  ━━ Traktör 1   ━━ Transit 1
     Çizgi üstü etiket:   🚜 Traktör 1 · Ahmet
```

Sütun içerikleri:

- **Sol (tarlalar)** — yalnızca o plana bağlanmış tarlalar. Alt tarafta
  `+ Tarla` düğmesi tarla seçiciyi açar. (Tüm tarlaları listelemek 25+ kutu
  demek olurdu.)
- **Orta (dizim alanları)** — 8 alanın tamamı her zaman görünür. Boş alanlar
  soluk çizilir; hangi alanın boş kaldığı planlamanın asıl sorusu.
- **Sağ (seralar)** — her bölmenin hedef seraları, o bölmenin hizasında gruplu.

Bağlantılar SVG çizgi ile çizilir; çizginin rengi aracın rengi, üstündeki
etiket `araç · şoför`.

### Sera kutusu

Sera kutusunda ad, ince doluluk çubuğu ve doluluk yüzdesi görünür. Mevcut
doluluk renk skalası (boş / %1-50 / %51-85 / %86-99 / %100+) aynen kullanılır.
Dolu seralar soluk çizilir ve seçilirken "bu sera zaten dolu" uyarısı çıkar —
engellenmez, çünkü gün içinde beklenenden fazla dolan seraya ekleme yapmak
sahada olağan.

### Etkileşim

**Bağlama.** Tarlaya dokun → seçili çerçeve. Bölmeye dokun → bağlanır; küçük bir
açılır kutu araç ve şoför adını sorar. Bölmeye dokun → seraya dokun → sera o
bölmeye eklenir.

**Değiştirme (futbol değişikliği mantığı).** Aynı türden iki kutu seçiliyken
`⇄ Değiştir` düğmesi aktifleşir:

- iki tarla → bağlantıları takas edilir
- iki dizim alanı → bütün bölme içerikleri takas edilir
- iki sera → yerleri takas edilir

**Kaldırma.** Seçili kutuya ikinci kez dokunmak seçimi bırakır. Bağlantı
üstündeki `×` bağı koparır.

**Bölme.** Alan kutusundaki `⊞ Böl` yeni bölme ekler (en çok 4).
`⊟ Birleştir` son bölmeyi bir öncekiyle birleştirir; içerikler üst bölmeye taşınır.

**Dünü Kopyala.** Seçili günün planı boşsa, bir önceki günün planını kopyalar.
Şoför adları kopyalanmaz (her gün değişiyor), araç atamaları kopyalanır.

### Uyarılar

- Aynı **bölmeye** farklı çeşitte tarla bağlanırsa bölme kırmızı çerçeve + ⚠
  alır, üstte "D.A1 ① bölmesinde BSB 6195 ve PVH 2310 karışıyor" uyarısı çıkar.
  **Engellenmez** — Mix ve deneme tarlaları var, kilitlemek işi tıkar.
- Farklı bölmelerde farklı çeşit olması normaldir, uyarı çıkmaz.
- Hiç bölme atanmamış alanlar alt satırda "D.A3, D.A4 boş" olarak listelenir.

### Dar ekran

Telefonda sütunlar dikey kart düzenine düşer: her dizim alanı bir kart, kartın
üstünde ⬅ GELEN (tarlalar + araç/şoför), altında ➡ GİDEN (seralar). Çizgi yerine
gruplama kullanılır. Bu, uygulamanın mevcut dar-ekran davranışıyla tutarlı.

## Diğer ekranlara bağlanma

### Çalışma işareti — türetme, yazma yok

Mevcut işaret sistemi bayrak değil **tarih** tutuyor; gece yarısı kendiliğinden
düşüyor ve kırım kaydı girilince de düşüyor. Plan bu alanlara **yazmayacak**,
işaret plandan türetilecek — böylece temizlik derdi doğmaz.

- `tarlaKirimYapiliyorMu(t)` → mevcut manuel işaret **veya** t bugünkü planda bir
  bölmede giriş olarak var ve o bölme henüz kırım kaydına dönüşmemiş
  (`kirimId == null`)
- `seraDolduruluyorMu(s)` → mevcut manuel işaret **veya** s bugünkü planda hedef
  sera ve bölmesi henüz dönüşmemiş

Sonuç: 5 Ağustos planı 4 Ağustos'ta kurulduğunda, 5 Ağustos gelince Tarlalar
panelinde 🔴 KIRIM YAPILIYOR bandı ve Seralar panelinde SERALAR DOLDURULUYOR
bandı kendiliğinden dolar.

`seraBosaltiliyorMu` plandan etkilenmez — plan yalnızca doldurma yönünü tarifler.

### Kırım kaydına dönüştürme

Her bölmenin `‹` düğmesi mevcut Kırım Kaydı ekranını açar; tarlalar, çeşit ve
hedef seralar plandan dolu gelir. Kullanıcı dizi/kg ve tarihleri girer. Kayıt
oluşunca bölmenin `kirimId` alanı dolar, şemada ✓ görünür, çalışma işareti düşer.

Bölme birden fazla tarla içeriyorsa mevcut çoklu-tarla kırım akışı kullanılır
(ortak kırım payı kuralları aynen geçerli).

### Gün içi düzenleme

Plan, tarihi geçmiş olsa da düzenlenebilir. Gün içinde beklenenden fazla sera
dolduysa plana o an sera eklenebilir; zorunlu değildir ama eklenirse bantlar ve
takip anında güncellenir.

## Kapsam dışı (bilerek)

- Serbest sürükle-bırak tuval (n8n tarzı düğüm editörü) — seçim tabanlı bağlama
  yeterli ve dokunmatik kullanımda daha güvenilir.
- Plan üzerinde kg/dizi tahmini — o bilgi kırım kaydında yaşar.
- Rol/izin ayrımı — herkes düzenleyebilir (uygulamanın bugünkü davranışı).
- Ödemeler ve Depo modüllerine dokunulmaz.
- Sezon arşivi için özel iş — sezon zaten tarihten türetiliyor, plan da tarihli.

## Test

`tests/run.js` içine eklenecek iddialar:

1. Bölme ekleme 4'te durur; birleştirme içerikleri üst bölmeye taşır.
2. Takas: iki tarla / iki alan / iki sera takasının doğru sonucu.
3. Aynı bölmede farklı çeşit → uyarı üretilir; farklı bölmelerde → üretilmez.
4. Bugünkü plandan `tarlaKirimYapiliyorMu` / `seraDolduruluyorMu` türetimi;
   `kirimId` dolunca işaretin düşmesi; dünkü planın işaret üretmemesi.
5. Bir seranın ikinci bölmeye eklenince öncekinden düşmesi.
6. "Dünü Kopyala" şoför adlarını kopyalamaz, araçları kopyalar.

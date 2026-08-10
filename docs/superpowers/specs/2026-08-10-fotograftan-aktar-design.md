# Fotoğraftan Aktar — Tasarım Şartnamesi

Tarih: 2026-08-10
Durum: **uygulandı** — v124–v131.
Plan: `docs/superpowers/plans/2026-08-10-fotograftan-aktar.md`

## Uygulama sırasında değişenler

**1. CORS varsayımı doğrulandı — proxy'ye gerek kalmadı.** Planın en büyük
riskiydi. Uygulamanın gerçek kaynağından (`mustafabasarsp-lab.github.io`)
geçersiz anahtarla istek atıldı: cevap JavaScript'e **401 olarak ulaştı**
(okunabilir gövdeyle). Tarayıcı engelleseydi `fetch` reddedilir, hiçbir durum
kodu görünmezdi. Cloud Functions proxy'si gerekmiyor.

**2. Planın "mevcut testler regresyon koruması" varsayımı yanlıştı.** Geçmiş
import'a değen tek bir test yoktu; `kirimSatiriUygula` ayrıştırması korumasız
yapılacaktı. Uçtan uca test yazıldı ve ayrıştırma öncesi sürümle karşılaştırıldı:
30 kayıt, 50.600 dizi, 129 dizim, 129 dönem, A5'in iki dönemi/biri kapalı — **12
ölçütün hepsi birebir aynı**.

**3. Çekirdeğe `oturumAnahtar` eklendi.** Geçmiş import 2. tur dolumu satır
NUMARASIYLA ayırt ediyor (`GECMIS_KIRIM_SATIRLARI`'nda aynı gün birden fazla
satır var), fotoğraf yolu kırım TARİHİYLE. Tek değere zorlamak geçmiş import'un
davranışını değiştirirdi.

**4. Koyu tema hatası tarayıcıda yakalandı.** Onay kartları `.field` içinde
olmadığı için girdiler uygulamanın belirteçli girdi kuralına girmiyor, tarayıcı
varsayılanına düşüp koyu temada beyaz kalıyorlardı. Belirteçler `.foto-satir`
altında tekrar bağlandı.

**5. `silmeYedekAl`'a isteğe bağlı mesaj eklendi.** Bildirim metni sabit
"`<etiket>` silindi." idi; aktarımda hiçbir şey silinmediği için yanıltıcıydı.

**6. Yerleşim.** Düğme kırım sayfasında (`dizim-plot` kalıbıyla, 44px dokunma
hedefi), anahtar alanı Ayarlar → Veri Yönetimi'nde.

## Doğrulama sonucu

- `node tests/run.js` → **519 geçiyor** (tur başında 434)
- `python tests/gorsel.py` → 360/390/430px × açık/koyu: taşma 0px, kırpılma yok
- Uçtan uca tarayıcı sürüşü: gerçek 2,8 MB fotoğraf → 2576px → 1,6 MB gövde;
  üç satır beklenen durumlarda (yeşil/kırmızı/sarı); kırmızı satır uygulanmadı;
  2 kırım kaydı, 1000 dizi; dizim tarihleri kırımdan ayrı; **anahtar state'e
  sızmadı**; 390px ve 360px koyu temada taşma 0px
- Geri alma: uygula → geri al → bellek, `localStorage` ve sayfa yenilemesi
  sonrası hepsi eski hâlinde

**Doğrulanmamış kalan:** gerçek model çağrısı (anahtar gerektirir) ve cihazlar
arası `cesitKodEslemesi` senkronu (`firestore.rules` yayını gerektirir).

## Amaç

Sahada tutulan iki kâğıdı telefonla fotoğraflayıp, uygulamanın kırım kaydı açmasını,
seraları doldurmasını ve önceki dönemi kapatmasını sağlamak. Bugün bu veriler
kâğıttan uygulamaya elle giriliyor; her tur 30 satıra varan yazım işi.

Bu bir "yeni modül" değil: **var olan aktarım borusuna yeni bir ağız takmak.**
`gecmisKirimDepoVerisiAktar()` (`scv-saha-v1.html:7394`) satır listesini alıp kırım
kaydı açan, seraları dolduran, ikinci tur dolumda önceki dönemi kapatan, tarlayı
kırım tarihinden eşleyen mantığı zaten içeriyor ve 40 kayıtla sahada doğrulandı.
Eksik olan tek şey, o satır listesini elle yazmak yerine fotoğraftan üretmek.

## İki kâğıt, tek olay

Kâğıtlar aynı olayı iki açıdan anlatıyor ve **birbirini tamamlıyor**:

| Kâğıt | Ne söylüyor | Koddaki karşılığı |
| --- | --- | --- |
| **Tablo** (`seralar güncel *.jpeg`) | Hangi gün kırılan tütün hangi seralara dizildi | `GECMIS_KIRIM_SATIRLARI` (`:7297`) |
| **Defter** (`* kırım tarihleri.jpeg`) | Hangi tarla hangi gün kırıldı, kaçıncı kırım | `GECMIS_TARLA_KIRIMLARI` (`:7333`) |

Tablo tarlayı içermiyor; tarla bağı **kırım tarihinin eşleşmesinden** kuruluyor.
Bu yüzden ikisi de kapsamda: defter olmadan tablo satırı tarlasız kırım kaydı
üretir (mevcut kod bunu zaten destekliyor — `tarlasizKayit` sayacı), defterle
birlikte tarla bağı da kurulur.

**Defter satırları ayrı kayıt olarak yazılmaz.** Aktarım oturumu boyunca bellekte
tutulup tablo satırlarının tarla eşlemesinde kullanılır — `GECMIS_TARLA_KIRIMLARI`
ile birebir aynı rol. Veri modeli değişmiyor; bu tasarımın en önemli kısıtı bu.

## Ölçülen kanıt

2026-08-10'da defter fotoğrafı (`2. kırım tarihleri.jpeg`) Claude Opus 5 ile okundu
ve okuma, uygulamadaki gerçek tarla verisiyle (`kalemliFideBilgileriniGuncelle`,
`:7234`) karşılaştırıldı. On satırın dokuzu dekar + çeşit + fide yöntemi olmak
üzere üç alanda birden tuttu.

Tek gerçek hata: `K19` satırı `K18` olarak okundu. Üç kontrol aynı anda patladı —
K18 17 dekar / PVH 2310 / yer ocağı, okunan satır ise 18 dekar / ITB 6179 / viyol.
Ve **doğrusunu da veri söylüyor**: bu tarif uygulamada tam olarak K19'a uyuyor
(18 da, ITB 6179, viyolDekar 18). Sistem "burada hata var" demekle kalmayıp
"bu K19 olmalı" diyebiliyor.

İkinci bulgu: `K21 - 52 da` okundu, uygulamada K21 = 51 dekar. Ya okuma ya kâğıt
yuvarlaması; hangisi olursa olsun **sarı bayrak** üretiyor.

Bu ölçüm tasarımın dayanağı: doğruluk yüksek ama %100 değil, ve hataların
neredeyse tamamı uygulamanın kendi verisiyle yakalanabiliyor.

## Kapsam

**İçinde:** her iki kâğıt; okuma, doğrulama, onay ekranı, mevcut aktarım borusuna
bağlama; Ayarlar'da anahtar alanı.

**Dışında:** depo/kutulama sayfaları; ödemeler; otomatik uygulama (aşağıya bak);
fotoğrafın uygulamada saklanması (okunur, gönderilir, atılır).

## Sınır: fotoğraf → kayıt değil, fotoğraf → form

Yakalanamayan tek hata sınıfı, **geçerli bir kodun başka geçerli bir koda
dönüşmesi**: `C24` yerine `C21`, ikisi de var, ikisi de o gün boş. Ne prompt ne
doğrulama bunu yakalar.

Bu yüzden özellik **hiçbir koşulda doğrudan kayıt açmaz.** Fotoğraf, önceden
doldurulmuş ve şüpheli hücreleri işaretli bir onay tablosu üretir; kullanıcı
bakar, düzeltir, uygular. Değer buradan geliyor: 10 dakikalık yazma işi 30
saniyelik kontrole iniyor. %90 doğruluk bile bu dönüşümü değerli kılar.

## Mimari

Altı parça. Dördü küçük, ağırlık onay ekranında.

### 1. Anahtar (Ayarlar)

Kullanıcı `console.anthropic.com`'dan aldığı anahtarı bir kez yapıştırır.

- `localStorage`'da **ayrı bir anahtar altında** durur (`scvYzAnahtar`), `scvTema`
  ve `scvLang` ile aynı kalıp: `try/catch` sarmalı, depolama kapalıysa oturumluk.
- **`state` içine ASLA yazılmaz.** `state` Firestore'a senkronlanıyor ve yedeğe
  giriyor (`:3181`, `:8133`); anahtar oraya girerse yedek dosyasına ve buluta
  sızar. Bu, bu tasarımın ihlal edilmemesi gereken tek güvenlik kuralı.
- Alan boşken özellik düğmesi görünür ama "önce Ayarlar'dan anahtar girin"
  diyerek yönlendirir.

### 2. Görüntü hazırlama

- `<input type="file" accept="image/*" capture="environment">` — telefonda
  doğrudan kamerayı açar. Uygulamada dosya girdisi kalıbı zaten var (`:2107`).
- Canvas'ta **uzun kenar 2576 piksele** ayarlanır. Bu bir küçültme hedefi değil
  bir *isabet* hedefi: modelin okuyabildiği en yüksek çözünürlük bu, ve
  `C21`/`C24` ayrımı tam olarak o piksellerde. Daha küçüğe indirmek doğruluğu
  düşürür; daha büyüğü zaten model tarafından indirilir.
- JPEG kalite 0.9, base64. Görüntü başına ~4.800 giriş jetonu.
- Kâğıt kolayca ters çekiliyor (elimizdeki iki örnek de ters) — ekranda 90°
  çevirme düğmesi bulunur.

### 3. Okuma (tek fonksiyon)

`POST https://api.anthropic.com/v1/messages`, `x-api-key` + `anthropic-version:
2023-06-01` başlıklarıyla, tarayıcıdan doğrudan.

- Model: `claude-opus-5`. Yüksek çözünürlüklü görü (2576px), en güçlü
  belge/tablo anlama, yapılandırılmış çıktı desteği.
- **Yapılandırılmış çıktı**: `output_config.format` ile `json_schema`. Model
  serbest metin döndüremez; şema `additionalProperties:false` + `required` ile
  kapalı. "JSON bozuk geldi" hata sınıfı ortadan kalkar.
- **Prompt'a gömülenler**: sabit sütun şeması, `state.seralar`'daki 148 seranın
  adı, `state.tarlalar`'daki kodlar ve çeşitler. Model serbest tahmin etmez,
  bilinen kümeden seçer.
- **Açık talimatlar**: üstü çizili satırlar okunmaz (defterde var); `(YARIM)`
  işareti yarım sera demektir; okunamayan hücre uydurulmaz, `null` bırakılır.
- `max_tokens` bol tutulur (≥ 8000). Opus 5'te düşünme varsayılan olarak açık ve
  `max_tokens` düşünme + metni **birlikte** sınırlar; dar tutulursa cevap yarıda
  kesilir.
- Efor varsayılan (`high`) bırakılır — dikkatli transkripsiyon işi.
- Sabit prompt (şema + sera listesi) prompt önbelleğine alınır; Opus 5'te alt
  sınır 512 jeton olduğu için bu prompt önbelleğe giriyor. Aynı oturumdaki ikinci
  fotoğraf o kısmı 0,1× fiyattan okur.
- `sw.js`'e `api.anthropic.com` by-pass'ı eklenir — hava durumundaki (`sw.js:44`)
  desenin aynısı. Çevrimdışıyken özellik kapalı görünür.

**Doğrulanacak:** tarayıcıdan doğrudan çağrı `anthropic-dangerous-direct-browser-access`
başlığını gerektiriyor. İlk iş tek bir küçük istekle bu doğrulanır; CORS engeli
çıkarsa tek alternatif Cloud Functions proxy'dir ve tasarımın geri kalanı aynı
kalır (yalnızca 3. parçanın adresi değişir).

### 4. Denetim (saf fonksiyon — testlerin ağırlığı burada)

Girdi: model çıktısı satır listesi + `state`. Çıktı: her satır için bayrak listesi.
DOM'a dokunmaz, ağa çıkmaz, testlenmesi kolay.

**Tablo satırı kuralları**

| Kural | Sonuç |
| --- | --- |
| Sera adı `state.seralar`'da yok | **kırmızı** — uygulanmaz |
| Soldurma sütunu ≠ (dizim − kırım) | **sarı** — hangisine güveneceği sorulur |
| Dizim < kırım | **sarı** |
| Aynı satırda tekrar eden sera | **sarı** |
| Sera o tarihte dolu | bilgi — "önceki dönem kapatılacak" |
| Aynı kırım + dizim + sera kümesinin **tamamı** kayıtlı | **gri** — atlanır |
| Kümenin **bir kısmı** kayıtlı | **sarı** — yalnızca kayıtsız seralar uygulanır, hangileri olduğu yazılır |
| Çeşit kodu (`kod:3`) bilinmiyor | açılır listeden seçilir, eşleme öğrenilir |

Kısmi eşleşme ayrı bir satır olarak duruyor çünkü kâğıtta bir satır sonradan
genişletilebiliyor (aynı güne sera eklenmesi). Tamamını gri sayıp atlamak yeni
seraları sessizce düşürürdü; tamamını yeni sayıp uygulamak mevcut dizimi ikinci
kez yazardı.

**Çeşit kodu eşlemesi nerede durur:** `state.cesitKodEslemesi` — kâğıttaki
`kod:3` gibi kodları uygulamadaki çeşit adına bağlayan tablo. Sır değil,
cihazlar arası paylaşılması istenen bir veri, dolayısıyla `state` içine girer.
**Nesne değil, kayıt dizisi olarak** tutulur (`[{id, kod, cesit}]`) — senkron
makinesi `SYNC_KOLEKSIYONLARI`'ndaki her girdinin `id` taşıyan kayıtlardan oluşan
bir dizi olmasını varsayıyor (`:3240`), düz bir eşleme nesnesi o makineye
oturmaz.
Bu da hafızadaki kurala tabidir: `bosState()`'e eklenecek, `SYNC_KOLEKSIYONLARI`
+ `firestore.rules`'a yazılacak (pre-commit hook ikisinin kopmasını zaten
engelliyor) ve **`stateNormalizeEt`'e eklenecek** — alanı olmayan eski bir
kayıttan açılış mutlaka test edilecek.

Soldurma sütunu bir **sağlama toplamı**: kâğıt hem tarihleri hem gün farkını
yazdığı için biri yanlış okunursa tutmaz.

Gri kural şart: kâğıt birikimli. Bir sonraki fotoğrafta eski satırlar da duracak,
altına yenileri eklenmiş olacak. Bu aynı zamanda **ücretsiz bir sınav kâğıdı**:
model eski satırları da doğru okuduysa yeni satırlara güven artar; okuyamadıysa
uyarı basılır.

**Defter satırı kuralları**

| Kural | Sonuç |
| --- | --- |
| Tarla kodu `state.tarlalar`'da yok | **kırmızı** |
| Dekar kayıtlı dekarla tutmuyor | **sarı** (ölçümde yakalanan hata sınıfı) |
| Çeşit kayıtlı çeşitle tutmuyor | **sarı** |
| Viyol/yer ocağı kayıtlı fide tipiyle tutmuyor | **sarı** |
| Üçü birden tutmuyor ama başka bir tarlaya tam uyuyor | **öneri**: "bu K19 olabilir" |

Son satır ölçümün doğrudan sonucu: üç bağımsız sağlamanın aynı anda başka bir
tarlaya uyması tesadüf değil, düzeltmenin kendisi.

### 5. Onay ekranı

Her satır bir kart; her hücre elle düzeltilebilir. Yeşil / sarı (uyarı metniyle) /
gri (atlanacak) / kırmızı (uygulanamaz). Sarı satır uygulanabilir — uyarı bilgi
amaçlı; kırmızı satır düzeltilmeden uygulanamaz.

Kart yerleşimi mevcut tasarım ölçeğini kullanır (`--fs-*`, `--r-*`, `--gecis-*`);
360px'te `tests/gorsel.py` ile doğrulanır.

### 6. Uygulama

`gecmisKirimDepoVerisiAktar()`'ın çekirdeği `kirimSatiriUygula(satir, eslesme)`
olarak ayrılır: kırım kaydını açar, seraları doldurur (`dizimUygula`, `:6849`),
önceki dönemi kapatır, tarlayı eşleme tablosundan bağlar. Mevcut fonksiyon bu
yeni çekirdeği çağıracak şekilde yeniden yazılır — mantık **kopyalanmaz**, aksi
halde iki yerde ayrışır.

Geri alma mevcut zincire bağlanır (`silmeYedekAl`).

Bonus: tablodaki "YETİŞTİRME B." sütunu, uygulamanın bugün karma tarlalarda
kullanıcıya **sorduğu** viyol/yer ocağı sorusunu kâğıttan cevaplıyor
(`seraFideTipiSec`, `:5575`). Fotoğraf o soruyu da kapatır.

## Maliyet

Fotoğraf başına ~4.800 giriş + ~3.000 çıkış jetonu ≈ **0,10 dolar**. Sezon boyunca
haftada birkaç fotoğraf; 5 dolarlık bakiye bütün sezonu götürür.

## Doğrulama

- `node tests/run.js` — şu an 434 geçiyor. Denetim fonksiyonunun her kuralı için
  bir test; `kirimSatiriUygula` ayrıştırması için mevcut import testleri
  regresyon koruması olarak kullanılır.
- `python tests/gorsel.py` — onay ekranı 360/390/430px × açık/koyu.
- Canlı doğrulama: gerçek bir fotoğraf, gerçek anahtar, tek satır uygulanır ve
  geri alınır.

## Riskler

| Risk | Karşılık |
| --- | --- |
| Geçerli kod → geçerli kod hatası | Onay ekranı; tek savunma bu ve bilerek öyle |
| Tarayıcıdan doğrudan çağrı engellenir | İlk iş doğrulanır; çıkmazsa Cloud Functions proxy, tasarımın kalanı aynı |
| Anahtar yedeğe/Firestore'a sızar | `state` dışında ayrı `localStorage` anahtarı; test yazılır |
| Üstü çizili satır okunur | Prompt'ta açık talimat + onay ekranı |
| Kullanıcı sarı bayrakları körlemesine geçer | Sarı sayısı üstte toplu gösterilir; hepsi sarıysa uygulama düğmesi ikinci onay ister |
| `max_tokens` dar kalır, cevap kesilir | ≥ 8000; `stop_reason: max_tokens` yakalanıp kullanıcıya "fotoğrafı ikiye böl" denir |
| İki kâğıt tek oturumda karışır | Defter önce, tablo sonra; ekran hangisini beklediğini yazar |

## İlgili

- `project-scv-kirim-akisi` (hafıza) — kod bazlı ekipler, çoklu tarla, kg tartım
- `feedback-scv-kirim-dizim-tarihleri` (hafıza) — kırım ve dizim tarihi ayrı
  alanlardır, "sadelik" için birleştirilmez; bu şartname o kurala uyar
- `project-scv-gecmis-veri-aktarimi` (hafıza) — 2026-07-30 kâğıttan yeniden kurulum
- `docs/superpowers/specs/2026-08-09-kroki-ve-hareket-katmani-design.md` — tasarım
  ölçeği ve görsel doğrulama aracı

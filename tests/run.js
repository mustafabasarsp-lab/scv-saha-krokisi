/* SCV Saha — regresyon testleri.
 *
 * Çalıştırma:  node tests/run.js
 *
 * Otomatik test çerçevesi yok (bağımlılık eklemeye değmez); aşağıdaki minik
 * assertion yardımcıları yeterli. Kapsam bilinçli olarak SAF HESAPLAR ve
 * DURUM GEÇİŞLERİ üzerinde: kg/dizi toplamları, sezon türetme, senkron patch
 * üretimi, bildirim aç/kapa gibi yanlış giderse veriyi ya da güveni bozan yerler.
 * Görsel/CSS davranışı buranın işi değil.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { kur } = require('./harness');

let gecen = 0, kalan = [];
function esit(gercek, beklenen, baslik) {
  const a = JSON.stringify(gercek), b = JSON.stringify(beklenen);
  if (a === b) { gecen++; return; }
  kalan.push(`${baslik}\n     beklenen: ${b}\n     gerçek  : ${a}`);
}
function dogru(deger, baslik) { esit(!!deger, true, baslik); }
function yanlis(deger, baslik) { esit(!!deger, false, baslik); }
function bolum(ad) { console.log('\n' + ad); }

/* ---------------------------------------------------------------
   Bildirim aç/kapa
   Tarayıcı izni geri alınamadığı için düğmenin tek yönlü kalması hatasıydı;
   testler "kapatılabiliyor mu" ve "kapalıyken susuyor mu" sorularını sorar.
   --------------------------------------------------------------- */
bolum('Bildirimler');
{
  // İzin verilmiş, tercih hiç yazılmamış: eski sürümden gelen kullanıcı açık sayılır
  const app = kur({ bildirimIzni: 'granted' });
  dogru(app.bildirimAcikMi(), 'izin var + tercih yok → açık (eski kullanıcı susturulmaz)');

  // Kapat
  app.bildirimAcKapa();
  yanlis(app.bildirimAcikMi(), 'kapatınca kapanır');
  esit(app._depo.getItem('scvBildirimTercih'), 'kapali', 'kapalı tercihi cihaza yazılır');

  // Kapalıyken hiçbir bildirim çıkmaz
  const oncekiSayi = app._gunluk.bildirimler.length;
  app.bildirimGoster('t1', 'başlık', 'gövde');
  esit(app._gunluk.bildirimler.length, oncekiSayi, 'kapalıyken bildirim gösterilmez');

  // Tekrar aç
  app.bildirimAcKapa();
  dogru(app.bildirimAcikMi(), 'tekrar açılabilir');
  esit(app._depo.getItem('scvBildirimTercih'), 'acik', 'açık tercihi cihaza yazılır');

  // Düğme metni ve görsel durumu tercihle birlikte değişir
  app.bildirimDurumGuncelle();
  esit(app._belge.getElementById('bildirimBtnText').textContent, 'Bildirimler Açık', 'açıkken düğme metni');
  dogru(app._belge.getElementById('bildirimBtn').classList.contains('acik'), 'açıkken düğme dolu görünür');
  app.bildirimAcKapa();
  esit(app._belge.getElementById('bildirimBtnText').textContent, 'Bildirimleri Aç', 'kapalıyken düğme metni');
  yanlis(app._belge.getElementById('bildirimBtn').classList.contains('acik'), 'kapalıyken düğme sönük');
  app._temizle();
}
{
  // İzin hiç istenmemiş: uygulama kendiliğinden açık saymamalı
  const app = kur({ bildirimIzni: 'default' });
  yanlis(app.bildirimAcikMi(), 'izin yokken kapalı');
  app._temizle();
}
{
  // Tarayıcı düzeyinde engellenmiş: açılamaz, kullanıcı bilgilendirilir
  const app = kur({ bildirimIzni: 'denied' });
  app.bildirimAcKapa();
  yanlis(app.bildirimAcikMi(), 'engelliyken açılamaz');
  dogru(app._gunluk.uyarilar.some(m => /engellenmiş/.test(m)), 'engelliyken kullanıcı uyarılır');
  app.bildirimDurumGuncelle();
  esit(app._belge.getElementById('bildirimBtnText').textContent, 'Bildirimler Engelli', 'engelli durumu düğmede yazar');
  app._temizle();
}

/* ---------------------------------------------------------------
   Çeviri: onay/uyarı kutuları
   --------------------------------------------------------------- */
bolum('Çeviri');
{
  const app = kur();
  app.currentLang = 'en';
  esit(app.i18n('Bu tarla silinsin mi?'), 'Delete this field?', 'silme onayı İngilizceye çevrilir');
  esit(app.i18n('Çeşit girin.'), 'Enter a variety.', 'zorunlu alan uyarısı çevrilir');
  esit(app.i18n('Bildirimler Engelli'), 'Notifications Blocked', 'bildirim durumu çevrilir');
  // Sözlükte olmayan metin Türkçe kalır, patlamaz
  esit(app.i18n('Bilinmeyen bir metin'), 'Bilinmeyen bir metin', 'karşılığı olmayan metin olduğu gibi döner');
  app._temizle();
}
{
  /* Kaynak denetimi: uyar()/onayla() içindeki SABİT metinlerin hepsinin sözlükte
     karşılığı olmalı. Yeni bir onay kutusu eklenip çevirisi unutulduğunda, İngilizce
     moddaki kullanıcı arayüzü İngilizce ama uyarıyı Türkçe görür — bu test o
     unutmayı yakalar. (İçinde ${...} taşıyan şablon metinler kapsam dışı: araya
     değer basıldığı için sözlükte anahtarları olamaz, bilinçli bir sınır.) */
  const kaynak = fs.readFileSync(path.join(__dirname, '..', 'scv-saha-v1.html'), 'utf8');
  const bas = kaynak.indexOf('const I18N_EN = {');
  const son = kaynak.indexOf('\n};', bas);
  // son+2: kapanış '\n}' dahil, sondaki ';' hariç (parantez içine alınacak)
  const sozluk = eval('(' + kaynak.slice(bas + 'const I18N_EN = '.length, son + 2) + ')');
  const sabitler = [...new Set(
    [...kaynak.matchAll(/\b(?:uyar|onayla)\('((?:[^'\\]|\\.)*)'\)/g)].map(m => eval("'" + m[1] + "'"))
  )];
  const eksik = sabitler.filter(t => !(t in sozluk));
  dogru(sabitler.length > 50, 'onay/uyarı metinleri kaynaktan okunabildi');
  esit(eksik.map(t => t.slice(0, 60)), [], 'çevirisi eksik onay/uyarı metni yok');
}

/* ---------------------------------------------------------------
   Cihaz deposu dolduğunda sessiz kalınmamalı
   --------------------------------------------------------------- */
bolum('Cihaz deposu');
{
  const app = kur();
  app.setSyncStatus(true);
  esit(app._belge.getElementById('syncStatusText').textContent, 'Kaydedildi · Herkese senkron', 'normalde senkron durumu yazar');

  app._depo.kotaAsimi = true;
  app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10 });
  app.localStorageYaz();

  dogru(app._belge.getElementById('syncStatus').classList.contains('depo-dolu'), 'kota dolunca rozet uyarıya döner');
  dogru(/Cihaz deposu dolu/.test(app._belge.getElementById('syncStatusText').textContent), 'kullanıcı ne yapacağını okur');
  // Depo doluyken günlük de diske yazılamaz; kayıt bellekte tutulup yine de okunabilmeli
  dogru(app.hataGunluguOku().some(k => k.tip === 'depo'), 'yazılamayan hata kaydı yine de günlükte görünür');
  dogru(/Cihaz deposuna yazılamadı/.test(app.hataGunluguMetne()), 'kopyalanacak metinde de yer alır');

  // Firestore'a yazma başarılı olsa bile uyarı ekranda kalmalı
  app.setSyncStatus(true);
  dogru(app._belge.getElementById('syncStatus').classList.contains('depo-dolu'), 'senkron başarılı olsa da uyarı öncelikli kalır');

  // Yer açılınca uyarı kendiliğinden kalkar
  app._depo.kotaAsimi = false;
  app.localStorageYaz();
  yanlis(app._belge.getElementById('syncStatus').classList.contains('depo-dolu'), 'yer açılınca uyarı kalkar');
  esit(app._belge.getElementById('syncStatusText').textContent, 'Kaydedildi · Herkese senkron', 'rozet eski durumuna döner');
  app._temizle();
}

/* ---------------------------------------------------------------
   Kırım / tarla hesapları
   Ortak kırımın payı tarla sayısına EŞİT bölünür (dekara göre değil) —
   tarlaların toplamı gerçek hasadı aşmasın diye.
   --------------------------------------------------------------- */
bolum('Kırım hesapları');
{
  const app = kur();
  app.state.tarlalar.push(
    { id: 't1', ad: 'K1', dekar: 10, bolge: 'kalemli' },
    { id: 't2', ad: 'K2', dekar: 30, bolge: 'kalemli' },
  );
  // Aynı gün iki tarla birlikte kırıldı: 1000 dizi × 2 kg = 2000 kg
  app.state.kirimlar.push({ id: 'k1', tarlaIds: ['t1', 't2'], tarih: '2026-07-10', diziSayisi: 1000, ortDiziKg: 2, kirimNo: 1, seraDagilimi: [] });

  esit(app.kirimTurev(app.state.kirimlar[0]).toplamKg, 2000, 'kırım toplam kg = dizi × ort. dizi kg');
  esit(app.tarlaStats('t1').toplamKg, 1000, 'ortak kırım payı eşit bölünür (küçük tarla)');
  esit(app.tarlaStats('t2').toplamKg, 1000, 'ortak kırım payı dekara göre oranlanmaz');
  esit(app.tarlaStats('t1').toplamKg + app.tarlaStats('t2').toplamKg, 2000, 'tarla payları toplamı gerçek hasadı aşmaz');

  // Dekar başına verim: 2000 kg ÷ 40 dekar
  esit(app.hesaplaRozetler().verimKirilan, 50, 'kg/dekar ağırlıklı toplamdan hesaplanır');
  app._temizle();
}
{
  // Tarlası girilmemiş kayıt: hiçbir tarlaya yazılmaz ama genel toplamda görünür
  const app = kur();
  app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10, bolge: 'kalemli' });
  app.state.kirimlar.push(
    { id: 'k1', tarlaIds: ['t1'], tarih: '2026-07-10', diziSayisi: 100, ortDiziKg: 2, kirimNo: 1, seraDagilimi: [] },
    { id: 'k2', tarlaIds: [], tarih: '2026-07-11', diziSayisi: 50, ortDiziKg: 2, seraDagilimi: [] },
  );
  esit(app.tarlaStats('t1').toplamKg, 200, 'tarlasız kayıt tarla toplamına karışmaz');
  esit(app.state.kirimlar.reduce((s, k) => s + app.kirimTurev(k).toplamKg, 0), 300, 'tarlasız kayıt genel toplamda sayılır');
  app._temizle();
}
{
  // Bekleyen dizi: kırılan ama henüz seraya dizilmemiş kısım
  const app = kur();
  app.state.kirimlar.push({ id: 'k1', tarlaIds: [], tarih: '2026-07-10', diziSayisi: 100, ortDiziKg: 2, seraDagilimi: [{ id: 'd1', seraId: 's1', diziSayisi: 40 }] });
  const tr = app.kirimTurev(app.state.kirimlar[0]);
  esit(tr.atananDizi, 40, 'seraya dizilen dizi sayısı');
  esit(tr.kalanDizi, 60, 'bekleyen dizi = kırılan − dizilen');
  app._temizle();
}

/* ---------------------------------------------------------------
   Sezon
   Sezon kayıtlara YAZILMAZ, tarihten türetilir. Testler hem türetmeyi hem de
   "geçen sezonun verisi bu sezonun rakamlarına karışmıyor" güvencesini korur.
   --------------------------------------------------------------- */
bolum('Sezon');
{
  const app = kur();
  esit(app.sezonTarihten('2026-07-10'), 2026, 'sezon tarihin yılından gelir');
  esit(app.sezonTarihten('2025-12-31'), 2025, 'yıl sonu kaydı kendi sezonuna düşer');
  esit(app.sezonTarihten(''), null, 'tarihsiz kayıt sezonsuzdur');
  esit(app.sezonTarihten('bozuk'), null, 'bozuk tarih sezon üretmez');
  app._temizle();
}
{
  const app = kur();
  app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10, bolge: 'kalemli' });
  app.state.kirimlar.push(
    { id: 'k25', tarlaIds: ['t1'], tarih: '2025-07-10', diziSayisi: 100, ortDiziKg: 2, kirimNo: 1, seraDagilimi: [] },
    { id: 'k26', tarlaIds: ['t1'], tarih: '2026-07-10', diziSayisi: 300, ortDiziKg: 2, kirimNo: 1, seraDagilimi: [] },
  );

  app.sezonSecildi(2026);
  esit(app.tarlaStats('t1').toplamKg, 600, 'seçili sezonun kg’ı yalnız o yıldan');
  esit(app.hesaplaRozetler().verimKirilan, 60, 'kg/dekar geçmiş sezonla şişmez');

  app.sezonSecildi(2025);
  esit(app.tarlaStats('t1').toplamKg, 200, 'geçmiş sezona dönülebilir');
  esit(app.hesaplaRozetler().verimKirilan, 20, 'geçmiş sezonun verimi ayrı hesaplanır');

  app.sezonSecildi('tum');
  esit(app.tarlaStats('t1').toplamKg, 800, '"tüm sezonlar" eski davranışı verir');

  esit(app.mevcutSezonlar(), [2026, 2025], 'veride görünen sezonlar yeniden eskiye listelenir');
  app._temizle();
}
{
  // Sezon seçimi cihazda kalıcı olmalı, her açılışta sıfırlanmamalı
  const app = kur();
  app.sezonSecildi(2025);
  esit(app._depo.getItem('scvSeciliSezon'), '2025', 'seçili sezon cihaza yazılır');
  app._temizle();
}
{
  // Tarlada sezon kapatma: yıllık bilgiler arşive, tarla temiz sezona
  const app = kur();
  app.state.tarlalar.push({
    id: 't1', ad: 'K1', dekar: 14, bolge: 'kalemli', cesit: 'Izmir',
    dikimTarihi: '2026-04-10', tahminiHasatKg: 5000,
    ilaclar: [{ ad: 'X', tarih: '2026-06-01', phi: 14 }],
    gubreler: [{ ad: 'Y', tarih: '2026-05-01', miktar: 20 }],
    zararlilar: [{ ad: 'Z', tarih: '2026-06-15', yuzde: 30 }],
  });
  app.state.kirimlar.push({ id: 'k1', tarlaIds: ['t1'], tarih: '2026-07-10', diziSayisi: 100, ortDiziKg: 2, kirimNo: 1, seraDagilimi: [] });

  app.sezonSecildi(2026);
  app.tarlaSezonuKapat('t1');
  const t = app.state.tarlalar[0];

  esit((t.gecmisSezonlar || []).length, 1, 'sezon arşive alınır');
  esit(t.gecmisSezonlar[0].sezon, 2026, 'arşiv doğru sezona yazılır');
  esit(t.gecmisSezonlar[0].cesit, 'Izmir', 'çeşit arşivde saklanır');
  esit(t.gecmisSezonlar[0].ilaclar.length, 1, 'ilaç geçmişi arşivde saklanır');
  esit(t.gecmisSezonlar[0].gerceklesenKg, 200, 'o sezonun gerçekleşen kg’ı arşive yazılır');
  esit(t.gecmisSezonlar[0].kirimSayisi, 1, 'kırım sayısı arşive yazılır');

  esit(t.cesit, '', 'tarla yeni sezona çeşitsiz girer');
  esit(t.ilaclar, [], 'ilaç geçmişi temizlenir');
  esit(t.gubreler, [], 'gübre geçmişi temizlenir');
  esit(t.zararlilar, [], 'zararlı geçmişi temizlenir');
  esit(t.tahminiHasatKg, 0, 'tahmini hasat sıfırlanır');
  esit(t.dekar, 14, 'dekar korunur (tarlanın büyüklüğü sezonla değişmez)');

  // Olay kayıtlarına dokunulmamalı — sezon zaten tarihlerinden geliyor
  esit(app.state.kirimlar.length, 1, 'kırım kayıtları silinmez');
  esit(app.tarlaStats('t1').toplamKg, 200, 'geçmiş sezon verisi hâlâ okunabilir');

  // İkinci kez kapatmak arşivi çiftlemez
  app.tarlaSezonuKapat('t1');
  esit(app.state.tarlalar[0].gecmisSezonlar.length, 1, 'aynı sezon iki kez arşivlenmez');
  dogru(app._gunluk.uyarilar.some(m => /zaten kapatılmış/.test(m)), 'tekrar denemede kullanıcı uyarılır');
  app._temizle();
}

/* ---------------------------------------------------------------
   Rozet önbelleği: aynı çizim turunda iki kez hesaplanmamalı,
   ama veri değişince MUTLAKA tazelenmeli (bayat rozet göstermek yasak)
   --------------------------------------------------------------- */
bolum('Rozet önbelleği');
{
  const app = kur();
  app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10, bolge: 'kalemli' });
  app.state.kirimlar.push({ id: 'k1', tarlaIds: ['t1'], tarih: '2026-07-10', diziSayisi: 100, ortDiziKg: 2, kirimNo: 1, seraDagilimi: [] });

  const ilk = app.hesaplaRozetler();
  dogru(app.hesaplaRozetler() === ilk, 'aynı tur içinde aynı nesne döner (yeniden hesaplanmaz)');
  esit(ilk.verimKirilan, 20, 'ilk hesap doğru');

  // Veri değişti ama önbellek atılmadı: eski sonuç dönmeye devam eder
  app.state.kirimlar[0].diziSayisi = 200;
  dogru(app.hesaplaRozetler() === ilk, 'önbellek atılmadan eski sonuç durur');

  // saveState önbelleği atar → taze hesap
  app.saveState();
  const ikinci = app.hesaplaRozetler();
  dogru(ikinci !== ilk, 'saveState sonrası yeniden hesaplanır');
  esit(ikinci.verimKirilan, 40, 'yeni veriyle doğru sonuç');

  // renderAll turu: saveState ile bittiği için sonraki tur her zaman taze başlar
  app.state.kirimlar[0].diziSayisi = 300;
  app.renderAll();
  esit(app.hesaplaRozetler().verimKirilan, 60, 'renderAll turu bayat rozet bırakmaz');
  app._temizle();
}

/* ---------------------------------------------------------------
   Firestore giden senkron: yalnızca DEĞİŞEN alanlar patch olarak gider
   (iki kişi aynı kaydın farklı alanını düzenlerse ikisi de kalsın diye)
   --------------------------------------------------------------- */

/* syncOutgoingNow gönderdiği anlık görüntüyü batch.commit() ÇÖZÜLDÜKTEN sonra
   günceller (yazma başarısızsa bir sonraki turda tekrar denensin diye). Bu yüzden
   iki gönderim arasında mikro-görev kuyruğunun boşalması beklenmeli. */
const tik = () => new Promise(r => setImmediate(r));

(async () => {
  /* -------------------------------------------------------------
     Tembel kütüphane yükleme
     Açılışta indirilmemeleri kadar, yüklenemediklerinde SESSİZ kalmamaları da
     önemli: kullanıcı düğmeye basıp hiçbir şey olmamasını hata sanmamalı.
     ------------------------------------------------------------- */
  bolum('Tembel kütüphane yükleme');
  {
    const app = kur(); // varsayılan: ağ yok
    esit(typeof app.XLSX, 'undefined', 'xlsx açılışta yüklenmez');
    esit(typeof app.L, 'undefined', 'leaflet açılışta yüklenmez');
    esit(app._gunluk.istenenKaynaklar.length, 0, 'açılışta hiçbir harici kütüphane istenmez');

    await app.excelDisaAktar();
    dogru(app._gunluk.istenenKaynaklar.some(u => /xlsx/.test(u)), 'Excel dışa aktarımda xlsx istenir');
    dogru(app._gunluk.uyarilar.some(m => /Excel kütüphanesi yüklenemedi/.test(m)), 'xlsx yüklenemezse kullanıcı uyarılır');

    await app.haritaMapBaslat();
    dogru(app._gunluk.istenenKaynaklar.some(u => /leaflet\.js/.test(u)), 'Haritalar açılınca leaflet istenir');
    dogru(app._gunluk.istenenKaynaklar.some(u => /leaflet\.css/.test(u)), 'leaflet CSS de istenir');
    dogru(app._gunluk.uyarilar.some(m => /Harita kütüphanesi yüklenemedi/.test(m)), 'leaflet yüklenemezse kullanıcı uyarılır');

    // Başarısız yükleme kalıcı olarak kilitlenmemeli: ikinci deneme yeni istek çıkarır
    const oncekiSayi = app._gunluk.istenenKaynaklar.filter(u => /xlsx/.test(u)).length;
    await app.excelDisaAktar();
    dogru(app._gunluk.istenenKaynaklar.filter(u => /xlsx/.test(u)).length > oncekiSayi, 'başarısız yükleme tekrar denenebilir');
    app._temizle();
  }
  {
    // Aynı kütüphane iki kez istenirse tek indirme yapılmalı
    const app = kur({ kutuphaneYuklenebilir: true });
    await Promise.all([app.kutuphaneYukle('xlsx'), app.kutuphaneYukle('xlsx')]);
    esit(app._gunluk.istenenKaynaklar.filter(u => /xlsx/.test(u)).length, 1, 'başarılı yükleme tek kez indirilir');
    app._temizle();
  }

  /* -------------------------------------------------------------
     Otomatik günlük yedek
     Bu, yanlış bir toplu silmeye karşı tek gerçek savunma; testler yedeğin
     ALINDIĞINI, tam olduğunu ve geri yüklenebildiğini doğrular.
     ------------------------------------------------------------- */
  bolum('Otomatik yedek');
  {
    const app = kur();
    app._girisYapildi();
    app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10, cesit: 'Izmir' });
    app.state.kirimlar.push({ id: 'k1', tarlaIds: ['t1'], tarih: '2026-07-10', diziSayisi: 100, ortDiziKg: 2, seraDagilimi: [] });

    await app.otomatikYedekAl();
    const yedekler = app._gunluk.firestoreDepo.get('yedekler');
    const bugun = app.todayStr();
    dogru(yedekler && yedekler.has(bugun), 'günün künye belgesi yazılır');
    esit(yedekler.get(bugun).parcaSayisi, 1, 'küçük veri tek parçaya sığar');
    dogru(yedekler.has(bugun + '__p0'), 'gövde parçası yazılır');

    // Aynı gün ikinci çağrı tekrar yazmamalı (kota boşa gitmesin)
    const oncekiBatch = app._gunluk.batchler.length;
    await app.otomatikYedekAl();
    esit(app._gunluk.batchler.length, oncekiBatch, 'aynı gün ikinci kez yedek alınmaz');

    // Yedek gerçekten okunabilir ve tam olmalı
    const paket = await app.otomatikYedekOku(bugun);
    esit(paket.veri.tarlalar.length, 1, 'yedekten tarla geri okunur');
    esit(paket.veri.kirimlar[0].diziSayisi, 100, 'yedekten kırım verisi bozulmadan gelir');
    app._temizle();
  }
  {
    // Veri henüz gelmemişken BOŞ yedek yazmak, o günün gerçek yedeğinin
    // yerine geçeceği için en tehlikeli senaryo.
    const app = kur();
    app._girisYapildi();
    await app.otomatikYedekAl();
    const yedekler = app._gunluk.firestoreDepo.get('yedekler');
    dogru(!yedekler || !yedekler.has(app.todayStr()), 'boş state yedeklenmez');
    app._temizle();
  }
  {
    // Büyük veri tek belgeye sığmaz: parçalanıp eksiksiz geri gelmeli
    const app = kur();
    app._girisYapildi();
    // Gövde YEDEK_PARCA_BOYUT'u (700 KB) kesin aşsın diye her kayda dolgu konur
    const dolgu = 'x'.repeat(200);
    for (let i = 0; i < 4000; i++) {
      app.state.depoKutulari.push({ id: 'kutu' + i, kutuNo: i, kg: 12.5, kalite: 'X1', tarih: '2026-07-20', bolge: 'kalemli', not: 'dolgu metni ' + i + dolgu });
    }
    await app.otomatikYedekAl();
    const bugun = app.todayStr();
    const kunye = app._gunluk.firestoreDepo.get('yedekler').get(bugun);
    dogru(kunye.parcaSayisi > 1, 'büyük veri birden çok parçaya bölünür');
    const paket = await app.otomatikYedekOku(bugun);
    esit(paket.veri.depoKutulari.length, 4000, 'parçalı yedek eksiksiz birleştirilir');
    esit(paket.veri.depoKutulari[3999].not, 'dolgu metni 3999' + dolgu, 'son kayıt da bozulmadan gelir');
    app._temizle();
  }
  {
    // Eksik parça: yarım veri döndürmektense hata vermeli
    const app = kur();
    app._girisYapildi();
    app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10 });
    await app.otomatikYedekAl();
    const bugun = app.todayStr();
    app._gunluk.firestoreDepo.get('yedekler').delete(bugun + '__p0');
    let hataAlindi = false;
    try { await app.otomatikYedekOku(bugun); } catch (e) { hataAlindi = /parças/.test(e.message); }
    dogru(hataAlindi, 'eksik parçada yarım veri değil hata döner');
    app._temizle();
  }
  {
    /* Saklama penceresi: yalnızca YEDEK_SAKLAMA_GUN'den ESKİ yedekler silinmeli.
       Bu test aynı zamanda "asıl veri temizlikten etkilenmiyor" güvencesini tutar —
       silme sorgusu yalnızca yedekler koleksiyonunda çalışır. */
    const app = kur();
    app._girisYapildi();
    const gun = app.YEDEK_SAKLAMA_GUN;
    esit(gun, 90, 'saklama süresi 90 gün');

    const bugun = app.todayStr();
    const yedekKol = new Map();
    app._gunluk.firestoreDepo.set('yedekler', yedekKol);
    const ekle = (tarih) => yedekKol.set(tarih, { id: tarih, tarih, kunye: true, parcaSayisi: 1 });
    const taze = app.yedekGunEkle(bugun, -(gun - 5));   // pencere içinde
    const sinirda = app.yedekGunEkle(bugun, -gun);      // tam sınır: korunur
    const eski = app.yedekGunEkle(bugun, -(gun + 5));   // pencere dışı
    [taze, sinirda, eski].forEach(ekle);

    // Asıl veri de dursun: temizlik ona dokunmamalı
    app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10 });
    app.syncOutgoingNow();
    await tik();

    await app.eskiYedekleriTemizle();
    dogru(yedekKol.has(taze), 'pencere içindeki yedek korunur');
    dogru(yedekKol.has(sinirda), 'tam sınırdaki yedek korunur');
    yanlis(yedekKol.has(eski), 'penceren eski yedek silinir');
    esit(app._gunluk.firestoreDepo.get('tarlalar').size, 1, 'temizlik asıl veriye dokunmaz');
    esit(app.state.tarlalar.length, 1, 'cihazdaki kayıtlar yerinde kalır');
    app._temizle();
  }
  {
    // Eski sürümden gelen, koleksiyonu eksik bir yedek uygulamayı çökertmemeli
    const app = kur();
    app.stateYerineKoy({ tarlalar: [{ id: 't1', ad: 'K1', dekar: 10 }] }); // seralar, kirimlar… yok
    esit(app.state.seralar, [], 'eksik koleksiyon boş dizi olarak tamamlanır');
    esit(app.state.odemeAyarlari, [], 'sonradan eklenen koleksiyonlar da tamamlanır');
    esit(app.state.tarlalar.length, 1, 'gelen veri korunur');
    app.renderAll(); // eksik koleksiyonla çizim patlamamalı
    dogru(true, 'eksik koleksiyonlu yedekten sonra çizim yapılabilir');
    app._temizle();
  }

  bolum('Senkron');
  {
    const app = kur();
    app._girisYapildi();
    esit(app._gunluk.dinleyiciler.length, app.SYNC_KOLEKSIYONLARI.length, 'senkron listesindeki her koleksiyon dinlenir');

    app.state.tarlalar.push({ id: 't1', ad: 'K1', dekar: 10, cesit: 'Izmir' });
    app.syncOutgoingNow();
    await tik();
    const ilk = app._gunluk.batchler.pop();
    esit(ilk.length, 1, 'yeni kayıt tek işlemle gönderilir');
    esit(ilk[0].tur, 'set', 'yeni kayıt set ile yazılır');
    esit(ilk[0].veri.ad, 'K1', 'yeni kayıt tam gövdesiyle gider');

    // Tek alan değişti: yalnızca o alan gitmeli
    app.state.tarlalar[0].dekar = 12;
    app.syncOutgoingNow();
    await tik();
    const ikinci = app._gunluk.batchler.pop();
    esit(Object.keys(ikinci[0].veri), ['dekar'], 'değişmeyen alanlar tekrar gönderilmez');
    esit(ikinci[0].sec, { merge: true }, 'patch merge ile yazılır');

    // Hiçbir şey değişmedi: tek bir yazma bile olmamalı
    const oncekiBatchSayisi = app._gunluk.batchler.length;
    app.syncOutgoingNow();
    await tik();
    esit(app._gunluk.batchler.length, oncekiBatchSayisi, 'değişiklik yoksa yazma yapılmaz');

    // Silinen kayıt sunucudan da silinmeli
    app.state.tarlalar.length = 0;
    app.syncOutgoingNow();
    await tik();
    const silme = app._gunluk.batchler.pop();
    esit(silme[0].tur, 'delete', 'silinen kayıt için delete gönderilir');
    esit(silme[0].ref._id, 't1', 'doğru belge silinir');
    app._temizle();
  }
  {
    // Belge id'si her zaman kaydın kendi id alanına eşit olmalı — firestore.rules
    // bu eşleşmeyi zorunlu kılıyor, bozulursa yazma sunucuda reddedilir.
    const app = kur();
    app._girisYapildi();
    app.state.seralar.push({ id: 's1', ad: 'B1', kapasite: 400, donemler: [] });
    app.syncOutgoingNow();
    await tik();
    const b = app._gunluk.batchler.pop();
    esit(b[0].ref._id, 's1', 'belge id = kaydın id alanı');
    esit(b[0].veri.id, 's1', 'gövdedeki id alanı korunur');
    app._temizle();
  }

  /* Saha Planlama testleri için ortak kurulum: 8 dizim alanı, 3 tarla, 4 sera.
     T bilerek YARIN: çalışma işareti BUGÜNÜN planından türetiliyor, sabit bir
     tarih kullansaydık test o gün çalıştırıldığında yanlış geçerdi. */
  function planOrtami() {
    const app = kur();
    app.dizimAlanlariTohumla();
    ['K11','K21','K13'].forEach((ad, i) => app.state.tarlalar.push({
      id: 't' + i, ad, dekar: 10, cesit: ad === 'K13' ? 'PVH 2310' : 'BSB 6195', bolge: 'kalemli'
    }));
    ['D1','D2','D4','C2'].forEach((ad, i) => app.state.seralar.push({
      id: 's' + i, ad, kapasite: 1000, bolge: 'kalemli', donemler: []
    }));
    const alanlar = app.dizimAlanlariSirali();
    /* "Yarın" YEREL bugünden türetilir. Önce Date.now()+86400000 üzerinden
       toISOString ile hesaplanıyordu ve bu gizli bir hataydı: toISOString UTC
       verdiği için UTC+3'te gece yarısı–03:00 arasında "UTC şimdi + 1 gün"
       bugünün yerel tarihine denk geliyor, yani T bugüne eşitleniyor ve
       "başka günün planı bugünkü işareti yakmaz" testi yanlış kalıyordu.
       todayStr()'i 'T00:00:00Z' ile sabitleyip gün eklemek her saatte doğru. */
    const d = new Date(app.todayStr() + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return { app, T: d.toISOString().slice(0, 10), a1: alanlar[0].id, a2: alanlar[1].id };
  }

  /* ---------------------------------------------------------------
     Saha Planlama — eski kayıttan yükseltme
     GERÇEK ARIZA: v107'den kalma kayıtlı state'te dizimAlanlari/sahaPlanlari
     anahtarları yok. tarlaKirimYapiliyorMu/seraDolduruluyorMu artık planı
     okuduğu için renderSeralar undefined.find() ile patlıyor, renderAll yarıda
     kesiliyor ve BÜTÜN paneller boş görünüyordu — veri yerinde olduğu hâlde.
     bosState() yeni anahtarları içerdiği için testler bunu göremiyordu;
     yükseltme yolu ayrıca sınanmalı.
     --------------------------------------------------------------- */
  bolum('Saha Planlama — eski kayıttan yükseltme');
  {
    const eskiKayit = JSON.stringify({
      tarlalar: [{ id:'t1', ad:'K11', dekar:61, cesit:'BSB 6195', bolge:'kalemli' }],
      seralar:  [{ id:'s1', ad:'A1', kapasite:400, bolge:'kalemli', donemler:[] }],
      kirimlar: [], haritaPinleri: [], tesisPinleri: [], depoKutulari: [],
      sulamaKayitlari: [], iklimKayitlari: [], dayibasilar: [],
      yevmiyeKayitlari: [], odemeKayitlari: [], odemeAyarlari: []
      // dizimAlanlari ve sahaPlanlari BİLEREK yok — v107 kaydının aynısı
    });
    const app = kur({ localStorage: { scvSahaKrokiV1: eskiKayit } });

    esit(app.state.dizimAlanlari, [], 'eksik dizimAlanlari boş diziye çekilir');
    esit(app.state.sahaPlanlari, [], 'eksik sahaPlanlari boş diziye çekilir');

    // Asıl arıza: bu iki yüklem patlıyordu
    yanlis(app.tarlaKirimYapiliyorMu(app.tarlaBul('t1')), 'eski kayıtta tarla işareti patlamadan çalışır');
    yanlis(app.seraDolduruluyorMu(app.seraBul('s1')), 'eski kayıtta sera işareti patlamadan çalışır');

    // Ve render gerçekten sonuna kadar gidiyor mu
    let hata = null;
    try { app.renderAll(); } catch(e) { hata = e.message; }
    esit(hata, null, 'eski kayıtla renderAll hatasız tamamlanır');
    dogru(app._belge.getElementById('seraPlot').innerHTML.includes('A1'), 'seralar çizilir');
    dogru(app._belge.getElementById('tarlaPlot').innerHTML.includes('K11'), 'tarlalar çizilir');
    app._temizle();
  }

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
    // Açılış tohumlamıyor: tohumlasaydı senkron verisi inmeden 8 yerel alan
    // yaratılır, uzaktan 8 alan daha inince 16 alan olurdu. Ayrıca bomboş bir
    // cihaz "dolu" görünüp içi tohumdan ibaret bir yedek yazdırırdı.
    app.renderAll();
    esit(app.state.dizimAlanlari.length, 0, 'açılış/render dizim alanı tohumlamaz');
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
    dogru(app.planGetir('2026-08-05') === plan, 'ikinci çağrı aynı belgeyi döndürür');

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
    dogru(app.planAlanGetir(plan, alanId) === alan, 'ikinci çağrı aynı alanı döndürür');

    dogru(app.planBosMu(plan), 'boş bölmeden ibaret plan hâlâ boş sayılır');
    dogru(app.planCopTopla('2026-08-05'), 'boş plan çöp toplanır');
    esit(app.state.sahaPlanlari.length, 0, 'çöp toplama sonrası belge kalmaz');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Saha Planlama — mutasyonlar
     Sahada bir dizim alanı kartonla bölünüp farklı kodlar ayrı ayrı indirilebiliyor;
     bölme mekaniği bunun karşılığı. Bir sera aynı anda tek bölmeye ait olabilir.
     --------------------------------------------------------------- */
  bolum('Saha Planlama — mutasyonlar');
  {
    // Bölme ekleme 4'te durur
    const { app, T, a1 } = planOrtami();
    esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 1, 'alan tek bölmeyle başlar');
    dogru(app.planBolmeEkle(T, a1), '2. bölme eklenir');
    dogru(app.planBolmeEkle(T, a1), '3. bölme eklenir');
    dogru(app.planBolmeEkle(T, a1), '4. bölme eklenir');
    yanlis(app.planBolmeEkle(T, a1), '5. bölme reddedilir');
    esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 4, 'bölme sayısı 4 te kalır');
    app._temizle();
  }
  {
    // Birleştirme içerikleri üst bölmeye taşır, yinelenen sera tekrar yazılmaz
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
    esit(alan.bolmeler[0].girisler.map(g => g.tarlaId), ['t0','t2'], 'girişler üst bölmeye taşındı');
    esit(alan.bolmeler[0].seraIds, ['s0','s1'], 'seralar üst bölmeye taşındı');
    yanlis(app.planBolmeBirlestir(T, a1), 'tek bölme daha fazla birleştirilemez');
    app._temizle();
  }
  {
    // Sera paylaşılabilir: aynı sera birden fazla bölmeye bağlanır, öncekinden
    // DÜŞMEZ. Sahada dört dizim alanının tütünü aynı seralara asılabiliyor.
    const { app, T, a1, a2 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
    app.planSeraEkle(T, a1, b1, 's0');
    app.planSeraEkle(T, a1, b1, 's1');
    esit(app.planAlanGetir(plan, a1).bolmeler[0].seraIds, ['s0','s1'], 'iki sera eklendi');

    app.planSeraEkle(T, a2, b2, 's0');
    esit(app.planAlanGetir(plan, a1).bolmeler[0].seraIds, ['s0','s1'], 's0 önceki bölmede kalır');
    esit(app.planAlanGetir(plan, a2).bolmeler[0].seraIds, ['s0'], 's0 ikinci bölmeye de bağlandı');

    yanlis(app.planSeraEkle(T, a2, b2, 's0'), 'aynı seranın tekrarı yok sayılır');
    esit(app.planAlanGetir(plan, a2).bolmeler[0].seraIds, ['s0'], 'liste yinelenmedi');
    app._temizle();
  }
  {
    // Aynı tarla aynı bölmede yinelenmez ama farklı bölmelerde olabilir
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
  {
    // Takas — iki tarla
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
  {
    // Takas — iki sera
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
  {
    // Takas — iki dizim alanı: bütün bölme içerikleri yer değiştirir
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
  {
    // Takas kendiyle yapılamaz
    const { app, T, a1 } = planOrtami();
    yanlis(app.planTarlaTakas(T, 't0', 't0'), 'tarla kendiyle takas edilmez');
    yanlis(app.planSeraTakas(T, 's0', 's0'), 'sera kendiyle takas edilmez');
    yanlis(app.planAlanTakas(T, a1, a1), 'alan kendiyle takas edilmez');
    app._temizle();
  }

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
  {
    // Farklı bölmelerde farklı çeşit normaldir — uyarı çıkmaz
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
    esit(app.planUyarilari(T).filter(u => u.includes('karış')).length, 0, 'ayrı bölmelerde karışma uyarısı yok');
    app._temizle();
  }
  {
    // Karışma uyarısı alan adını ve bölme numarasını söyler
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli');
    const uyarilar = app.planUyarilari(T);
    esit(uyarilar.filter(u => u.includes('karış')).length, 1, 'tek karışma uyarısı');
    dogru(uyarilar.some(u => u.includes('D.A1') && u.includes('BSB 6195') && u.includes('PVH 2310')),
      'uyarı alan adını ve iki çeşidi içerir');
    app._temizle();
  }
  {
    // Boş alanlar
    const { app, T, a1 } = planOrtami();
    esit(app.planBosAlanIdleri(T).length, 8, 'plan yokken 8 alanın hepsi boş');
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    esit(app.planBosAlanIdleri(T).length, 7, 'giriş alan bir alanı boş listesinden çıkarır');
    yanlis(app.planBosAlanIdleri(T).includes(a1), 'dolu alan boş listesinde yok');
    app._temizle();
  }

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
    const plan = app.planGetir(T);
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
  {
    // Elle konan işaret plandan bağımsız çalışmaya devam eder
    const { app } = planOrtami();
    const t0 = app.tarlaBul('t0'), s0 = app.seraBul('s0');
    app.calismaIsaretiUygula(t0, 'kirimIsaretTarihi', true);
    app.seraIsaretiUygula(s0, 'doldurma');
    dogru(app.tarlaKirimYapiliyorMu(t0), 'elle işaret hâlâ çalışır');
    dogru(app.seraDolduruluyorMu(s0), 'elle sera işareti hâlâ çalışır');
    app._temizle();
  }
  {
    // Boşaltma işareti plandan etkilenmez — plan yalnız doldurma yönünü tarifler
    const { app, a1 } = planOrtami();
    const bugun = app.todayStr();
    const plan = app.planGetir(bugun);
    const b = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planSeraEkle(bugun, a1, b, 's0');
    yanlis(app.seraBosaltiliyorMu(app.seraBul('s0')), 'plan boşaltma işaretini yakmaz');
    app._temizle();
  }

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
    // Gerileme: sekme tam ekranı ZORLAMAMALI. Zorlayınca tam ekran panel
    // (position:fixed, inset:10px) Tarlalar ve Seralar panellerini örtüyor ve
    // kullanıcı verisini kaybettiğini sanıyor.
    yanlis(b.getElementById('sahaGenelPanelBox').classList.contains('panel-fullscreen'), 'sekme tam ekranı zorlamaz');
    yanlis(b.body.classList.contains('has-fullscreen-panel'), 'sekme gövdeyi kaydırma kilidine sokmaz');

    app.sahaGenelSekmeGecis('genel');
    esit(app.sahaGenelSekmeAktif, 'genel', 'geri dönülür');
    yanlis(b.getElementById('sahaGenelIcerikGenel').classList.contains('hidden'), 'genel içerik geri gelir');
    app._temizle();
  }
  {
    // Gerileme: tam ekran panel açıkken sayfa değişirse kaydırma kilidi kalmamalı.
    // Kalırsa gidilen sayfa (Depo, Sulama…) hiç kaydırılamıyor.
    const app = kur();
    const b = app._belge;
    app.panelTamEkranAc('sahaGenelPanelBox');
    dogru(b.body.classList.contains('has-fullscreen-panel'), 'tam ekran gövdeyi kilitler');

    app.sayfaGecis('pageDepo');
    yanlis(b.body.classList.contains('has-fullscreen-panel'), 'sayfa değişince kaydırma kilidi kalkar');
    yanlis(b.getElementById('sahaGenelPanelBox').classList.contains('panel-fullscreen'), 'sayfa değişince tam ekran kapanır');
    app._temizle();
  }
  {
    // Tarih gezinme
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
  {
    // Uyarılar seçili günün planından çizilir
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

  /* ---------------------------------------------------------------
     Saha Planlama — şema çizimi
     Şema kullanıcının tek bilgi kaynağı. Yeni düzende her dizim alanı bir
     KART; 8 alanın 8 kartının da her koşulda çizilmesi ve toplanmış kartın
     sabit kalması (taşan çipler "+N" olur) davranışın kendisi.
     --------------------------------------------------------------- */
  bolum('Saha Planlama — şema çizimi');
  {
    const { app, T } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    const html = app._belge.getElementById('planSema').innerHTML;

    // Düğümde sahadaki tabelanın karşılığı yazar (kısa ad + DİZİM rozeti);
    // 'D.' önekli tam ad title olarak durur — arama/rapor/yedek tarafı onu kullanır.
    dogru(html.includes('>A1<'), 'düğümde kısa ad yazar');
    dogru(html.includes('title="D.A1"'), 'tam ad title olarak taşınır');
    dogru(html.includes('title="D.B4"'), '8 alanın sonuncusu da çizilir');
    esit((html.match(/class="plan-kart/g) || []).length, 8, '8 alanın 8 kartı da çizilir');
    dogru(html.includes(app.i18n('DİZİM')), 'DİZİM rozeti basılır');
    dogru(html.includes('plan-alan-bos'), 'boş alan solgun sınıfla işaretlenir');
    dogru(html.includes('plan-cip-bos'), 'boş uçta "+ Tarla / + Sera" yer tutucusu var');
    app._temizle();
  }
  {
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planGirisEkle(T, a1, b1, 't1', 'traktor1', 'Ahmet');
    app.planSeraEkle(T, a1, b1, 's0');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    const html = app._belge.getElementById('planSema').innerHTML;

    dogru(html.includes('K11') && html.includes('K21'), 'bağlanan tarlalar kartın sol ucunda');
    dogru(html.includes('D1'), 'hedef sera kartın sağ ucunda');
    dogru(html.includes('ikon-traktor'), 'araç türü ikonla gösterilir');
    dogru(html.includes('ikon-sera'), 'sera ikonu basılır');
    dogru(html.includes('plan-konektor'), 'uçlar konektörle bağlanır');
    dogru(html.includes('Traktör 1') && html.includes('Ahmet'), 'araç ve şoför çipin başlığında');
    app._temizle();
  }
  {
    // Uç satır bütçesi: kartın sabit yüksekliği buna dayanıyor, ve "+" yer
    // kaldıkça görünür kalmalı — ikinci tarlayı eklemek için kartı açmak
    // gerektiği anlaşılmıyordu.
    const app = kur();
    esit(app.planUcDagilimi([]),            { gorunen: [],       ekle: true,  fazla: 0 }, '0 öğe → yalnız +');
    esit(app.planUcDagilimi(['a']),         { gorunen: ['a'],    ekle: true,  fazla: 0 }, '1 öğe → çip + ekle');
    esit(app.planUcDagilimi(['a','b']),     { gorunen: ['a','b'],ekle: false, fazla: 0 }, '2 öğe → iki çip, yer yok');
    esit(app.planUcDagilimi(['a','b','c']), { gorunen: ['a'],    ekle: false, fazla: 2 }, '3 öğe → çip + "+2"');
    app._temizle();
  }
  {
    // Aynısı gerçek şemada: dolu uçta "+N", tek girişli uçta hâlâ "+" var
    const { app, T, a1, a2 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
    ['t0','t1','t2'].forEach(id => app.planGirisEkle(T, a1, b1, id, 'traktor1', 'Ahmet'));
    app.planGirisEkle(T, a2, b2, 't0', 'traktor1', 'Ahmet');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    const html = app._belge.getElementById('planSema').innerHTML;
    dogru(html.includes('plan-cip-fazla') && html.includes('+2'), 'taşan uç "+2" olarak katlanır');
    dogru(html.includes('plan-cip-bos'), 'yer kalan uçta ekleme çipi durur');
    app._temizle();
  }
  {
    // Kart açılınca bölme ayrıntısı ve düzenleme düğmeleri görünür
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    yanlis(app._belge.getElementById('planSema').innerHTML.includes('plan-detay-bolme'), 'toplanmış kartta bölme ayrıntısı yok');

    app.planKartTikla(a1);
    const acik = app._belge.getElementById('planSema').innerHTML;
    esit(app.planAcikAlanId, a1, 'karta dokunmak onu açar');
    dogru(acik.includes('plan-detay-bolme'), 'açık kartta bölme ayrıntısı var');
    dogru(acik.includes('BSB 6195'), 'açık kartta bölme çeşidi yazılır');
    dogru(acik.includes('planBolmeEkleTikla'), 'açık kartta Böl düğmesi var');

    app.planKartTikla(a1);
    esit(app.planAcikAlanId, null, 'aynı karta tekrar dokunmak kapatır');
    app._temizle();
  }
  {
    // Karışık bölme kırmızı sınıf alır — yalnız açık kartta görünür,
    // toplanmış kartta bölme ayrımı zaten gösterilmiyor.
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    app.planKartTikla(a1);
    yanlis(app._belge.getElementById('planSema').innerHTML.includes('plan-detay-bolme karisik'), 'tek çeşitte uyarı sınıfı yok');

    app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli');
    app.renderSahaPlanlama();
    dogru(app._belge.getElementById('planSema').innerHTML.includes('plan-detay-bolme karisik'), 'karışık bölme uyarı sınıfı alır');
    app._temizle();
  }
  {
    // Akış animasyonu yalnız BUGÜNÜN planında oynar
    const { app } = planOrtami();
    const bugun = app.todayStr();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(bugun);
    dogru(app._belge.getElementById('planSema').classList.contains('plan-bugun'), 'bugünün planında akış açık');
    app.planTarihSecildi('2020-01-01');
    yanlis(app._belge.getElementById('planSema').classList.contains('plan-bugun'), 'başka günde akış kapalı');
    app._temizle();
  }
  {
    // Dizim alanı hiç yoksa tohumlama düğmesi çıkar (açılışta kendiliğinden tohumlanmıyor)
    const app = kur();
    app.sahaGenelSekmeGecis('planlama');
    const html = app._belge.getElementById('planSema').innerHTML;
    dogru(html.includes('dizimAlanlariTohumlaTikla'), 'alan yoksa tohumlama düğmesi gösterilir');
    esit(app.state.dizimAlanlari.length, 0, 'düğme gösterilmesi tohumlamaz');

    app.dizimAlanlariTohumlaTikla();
    esit(app.state.dizimAlanlari.length, 8, 'düğmeye basınca 8 alan kurulur');
    yanlis(app._belge.getElementById('planSema').innerHTML.includes('dizimAlanlariTohumlaTikla'), 'kurulduktan sonra düğme kaybolur');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Saha Planlama — bağlama ve kipler
     Normal kipte karta dokunmak onu açar. İki geçici kip var: 'cogalt' bir
     girişi başka alanlara indirir, 'takas' aynı türden iki öğeyi değiştirir.
     --------------------------------------------------------------- */
  bolum('Saha Planlama — bağlama ve kipler');
  {
    // Tarla + araç + şoför tek kipte sorulur
    const { app, T, a1 } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;

    app.openPlanGirisModal(a1, b1);
    const kip = app._belge.getElementById('modalContent').innerHTML;
    dogru(kip.includes('K11'), 'tarla listesi kipte');
    dogru(kip.includes('Traktör 1') && kip.includes('Transit 1'), 'araç seçenekleri kipte');
    dogru(kip.includes('ikon-transit'), 'araç seçenekleri ikonlu');

    app.planGirisTarlaSec('t0');
    app.planGirisAracSec('transit1');
    app._belge.getElementById('planGirisSofor').value = ' Ahmet ';
    app.submitPlanGiris(a1, b1);

    const bolme = app.planBolmeBul(plan, a1, b1);
    esit(bolme.girisler.length, 1, 'giriş eklendi');
    esit(bolme.girisler[0].aracId, 'transit1', 'seçilen araç yazıldı');
    esit(bolme.girisler[0].sofor, 'Ahmet', 'şoför adının boşlukları kırpıldı');
    app._temizle();
  }
  {
    // ÇOKLU TARLA: bir dizim alanına aynı kipte birkaç tarla birden bağlanır
    const { app, T, a1 } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;

    app.openPlanGirisModal(a1, b1);
    app.planGirisTarlaSec('t0');
    app.planGirisTarlaSec('t1');
    app.planGirisTarlaSec('t2');
    app.planGirisTarlaSec('t1');           // tekrar dokunmak seçimi kaldırır
    esit(app.planGirisTarlaIds, ['t0','t2'], 'seçim çoklu ve geri alınabilir');
    app.planGirisAracSec('traktor2');
    app._belge.getElementById('planGirisSofor').value = 'Osman';
    app.submitPlanGiris(a1, b1);

    const bolme = app.planBolmeBul(plan, a1, b1);
    esit(bolme.girisler.map(g => g.tarlaId), ['t0','t2'], 'iki tarla birden eklendi');
    dogru(bolme.girisler.every(g => g.aracId === 'traktor2' && g.sofor === 'Osman'),
      'hepsi aynı araç ve şoförle bağlandı');
    app._temizle();
  }
  {
    // Zaten bağlı olanlar atlanır, yenisi yine de eklenir
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);

    app.openPlanGirisModal(a1, b1);
    app.planGirisTarlaSec('t0');           // zaten bölmede
    app.planGirisTarlaSec('t1');           // yeni
    app.submitPlanGiris(a1, b1);
    esit(app.planBolmeBul(plan, a1, b1).girisler.map(g => g.tarlaId), ['t0','t1'],
      'yeni olan eklendi, yinelenen atlandı');
    dogru(app._gunluk.uyarilar.some(m => /bir kısmı/i.test(m)), 'kısmi atlama bildirilir');
    app._temizle();
  }
  {
    // AYNI TARLA BİRDEN FAZLA ALANA: kip her alanda ayrı ayrı açılabilir
    const { app, T, a1, a2 } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);

    [a1, a2].forEach(alanId => {
      app.openPlanGirisModal(alanId, '');
      app.planGirisTarlaSec('t0');
      app.planGirisTarlaSec('t1');
      app.submitPlanGiris(alanId, '');
    });
    const plan = app.planGetir(T);
    [a1, a2].forEach(alanId => {
      const b = app.planAlanGetir(plan, alanId).bolmeler[0];
      esit(b.girisler.map(g => g.tarlaId), ['t0','t1'], 'aynı tarlalar bu alana da bağlandı');
    });
    app._temizle();
  }
  {
    // Tarla seçilmeden Bağla'ya basmak kaydetmez, uyarır
    const { app, T, a1 } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    app.openPlanGirisModal(a1, '');
    app.submitPlanGiris(a1, '');
    dogru(app._gunluk.uyarilar.some(m => /tarla/i.test(m)), 'tarlasız gönderim uyarır');
    yanlis(!!app.planBul(T), 'uyarı verilen denemede plan belgesi yazılmaz');
    app._temizle();
  }
  {
    // Plan hiç yokken kartın "+ Tarla" yolu: bölme kimliği YAZMA anında çözülür
    const { app, T, a1 } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    yanlis(!!app.planBul(T), 'şemaya bakmak plan belgesi yaratmaz');

    app.openPlanGirisModal(a1, '');
    app.planGirisTarlaSec('t0');
    app._belge.getElementById('planGirisSofor').value = 'Ahmet';
    app.submitPlanGiris(a1, '');
    const alan = app.planGetir(T).alanlar.find(x => x.alanId === a1);
    esit(alan.bolmeler[0].girisler.length, 1, 'boş bölme kimliği ilk bölmeye çözülür');
    app._temizle();
  }
  {
    // Sera bağlama kipi: çoklu seçim, kaydette fark uygulanır
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planSeraEkle(T, a1, b1, 's0');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);

    app.openPlanSeraSecModal(a1, b1);
    esit(app.planSeraSecim, ['s0'], 'kip mevcut seralarla açılır');
    app.planSeraSecTikla('s1');   // ekle
    app.planSeraSecTikla('s0');   // çıkar
    app.submitPlanSera(a1, b1);
    esit(app.planBolmeBul(plan, a1, b1).seraIds, ['s1'], 'fark uygulanır: s0 düştü, s1 eklendi');
    app._temizle();
  }
  {
    // ÇOKLU BAĞLANTI: aynı sera birden fazla alana bağlanabilir.
    // Eski kural serayı öncekinden düşürüyordu; sahada D.A1…D.A4 aynı seralara
    // asabildiği için o kısıt kaldırıldı.
    const { app, T, a1, a2 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;

    dogru(app.planSeraEkle(T, a1, b1, 's0'), 'sera ilk alana bağlandı');
    dogru(app.planSeraEkle(T, a2, b2, 's0'), 'aynı sera ikinci alana da bağlanır');
    esit(app.planBolmeBul(plan, a1, b1).seraIds, ['s0'], 'ilk bağlantı yerinde kaldı');
    esit(app.planBolmeBul(plan, a2, b2).seraIds, ['s0'], 'ikinci bağlantı da kuruldu');
    yanlis(app.planSeraEkle(T, a1, b1, 's0'), 'aynı bölmeye ikinci kez yazılmaz');

    app.planSeraKaldir(T, a1, b1, 's0');
    esit(app.planBolmeBul(plan, a1, b1).seraIds, [], 'kaldırma yalnız hedef bölmeyi etkiler');
    esit(app.planBolmeBul(plan, a2, b2).seraIds, ['s0'], 'öteki bağlantı dokunulmadan durur');
    app._temizle();
  }
  {
    // Bugünün çalışma işareti çoklu bağlantıda tekilleşir
    const { app, a1, a2 } = planOrtami();
    const bugun = app.todayStr();
    const plan = app.planGetir(bugun);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
    app.planSeraEkle(bugun, a1, b1, 's0');
    app.planSeraEkle(bugun, a2, b2, 's0');
    esit(app.bugunPlanSeraIdleri(), ['s0'], 'iki alana bağlı sera işarette bir kez sayılır');
    app._temizle();
  }
  {
    // ÇOĞALTMA KİPİ: bir giriş başka alanlara aynı araç/şoförle iner
    const { app, T, a1, a2 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'transit1', 'Ahmet');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);

    app.planCogaltBaslat(a1, b1, 't0');
    esit(app.planKip.tur, 'cogalt', 'çoğaltma kipi açıldı');
    const html = app._belge.getElementById('planSema').innerHTML;
    dogru(html.includes('hedef'), 'diğer kartlar hedef olarak işaretlenir');
    dogru(html.includes('kaynak'), 'kaynak kart ayrı işaretlenir');
    dogru(app._belge.getElementById('planKipSerit').innerHTML.includes('Ahmet'), 'kip şeridi ne kopyalandığını yazar');

    app.planKartTikla(a2);
    const hedef = app.planGetir(T).alanlar.find(x => x.alanId === a2).bolmeler[0];
    esit(hedef.girisler.length, 1, 'giriş hedef alana kopyalandı');
    esit(hedef.girisler[0].aracId, 'transit1', 'araç birlikte kopyalanır');
    esit(hedef.girisler[0].sofor, 'Ahmet', 'şoför birlikte kopyalanır');
    esit(app.planKip.tur, 'cogalt', 'kip açık kalır — aynı tarla birden çok alana iner');

    app.planKipBirak();
    esit(app.planKip, null, 'Bitir kipi kapatır');
    app._temizle();
  }
  {
    // TAKAS KİPİ: iki tarla, ikinci dokunuşta anında takas
    const { app, T, a1, a2 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    const b2 = app.planAlanGetir(plan, a2).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planGirisEkle(T, a2, b2, 't2', 'transit1', 'Veli');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);

    app.planTakasKipiAc();
    esit(app.planKip.tur, 'takas', 'takas kipi açıldı');
    app.planGirisCipTikla(a1, 't0');
    dogru(app.planTakasIsaretliMi('tarla','t0'), 'ilk öğe işaretlendi');
    app.planGirisCipTikla(a2, 't2');
    esit(app.planBolmeBul(plan, a1, b1).girisler[0].tarlaId, 't2', 'tarlalar takas edildi');
    esit(app.planKip, null, 'takastan sonra kip kapanır');
    app._temizle();
  }
  {
    // Takas kipinde uyumsuz çift: tarla işaretliyken seraya dokunmak uyarır
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planSeraEkle(T, a1, b1, 's0');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);

    app.planTakasKipiAc();
    app.planGirisCipTikla(a1, 't0');
    app.planSeraCipTikla(a1, 's0');
    dogru(app._gunluk.uyarilar.some(m => /aynı türden/i.test(m)), 'uyumsuz çift uyarır');
    dogru(app.planTakasIsaretliMi('tarla','t0'), 'ilk işaret korunur');
    app._temizle();
  }
  {
    // Normal kipte çipe dokunmak kartı açar (düzenleme oradan yapılır)
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    app.planGirisCipTikla(a1, 't0');
    esit(app.planAcikAlanId, a1, 'çipe dokunmak kartı açar');
    app._temizle();
  }
  {
    // Bölme ekle / birleştir düğmeleri
    const { app, T, a1 } = planOrtami();
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    app.planBolmeEkleTikla(a1);
    esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 2, 'böl düğmesi bölme ekler');
    app.planBolmeBirlestirTikla(a1);
    esit(app.planAlanGetir(app.planGetir(T), a1).bolmeler.length, 1, 'birleştir düğmesi bölme azaltır');
    app._temizle();
  }
  {
    // Şoför önerileri son 30 günden derlenir, yinelenmez
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planGirisEkle(T, a1, b1, 't1', 'traktor1', 'Ahmet');
    app.planGirisEkle(T, a1, b1, 't2', 'transit1', 'Veli');
    esit(app.planSoforOnerileri(), ['Ahmet','Veli'], 'öneriler benzersiz ve sıralı');

    const eski = app.planGetir('2020-01-01');
    const eb = app.planAlanGetir(eski, a1).bolmeler[0].id;
    app.planGirisEkle('2020-01-01', a1, eb, 't0', 'traktor1', 'Eski Şoför');
    yanlis(app.planSoforOnerileri().includes('Eski Şoför'), '30 günden eski ad önerilmez');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Saha Planlama — bağlantı çizgileri
     Geometri gerçek düzene bağlı; testin işi çizimin ölçüm alınamayan
     ortamda (ve şema boşken) patlamadan sessizce geçmesi.
     --------------------------------------------------------------- */
  bolum('Saha Planlama — konektörler');
  {
    // Gerileme: konektör ÖLÇÜMSÜZ olmalı. Eski çizim getBoundingClientRect'e
    // dayanıyordu ve ölçüm alınamayan her ortamda (arka plandaki sekme, gizli
    // panel, test koşumu) çizgiler hiç çizilmiyordu.
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planSeraEkle(T, a1, b1, 's0');
    app.sahaGenelSekmeGecis('planlama');
    app.planTarihSecildi(T);
    const html = app._belge.getElementById('planSema').innerHTML;
    dogru(html.includes('<svg viewBox="0 0 28 64"'), 'konektör sabit viewBox ile çizilir');
    dogru(html.includes('vector-effect') === false, 'kalınlık CSS tarafında tutulur, yolda değil');
    dogru((html.match(/<path d="M0,/g) || []).length >= 2, 'gelen ve giden için birer yol çizilir');
    app._temizle();
  }
  {
    // Yolun rengi ARACIN rengidir: hangi çizginin kimin taşıdığını anlatır.
    const app = kur();
    esit(
      (app.planKonektorSvg(['tomato'], 'sol').match(/stroke="tomato"/g) || []).length,
      1, 'tek giriş, aracın renginde tek yol'
    );
    esit((app.planKonektorSvg(['a','b','c'], 'sol').match(/<path /g) || []).length, 3, 'üç giriş, üç yol');
    yanlis(app.planKonektorSvg([], 'sol').includes('<svg'), 'bağlantı yoksa svg basılmaz');
    app._temizle();
  }

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
    const { app, a1 } = planOrtami();
    dogru(app.dizimAlaniAdDegistir(a1, 'D.A1 Üst'), 'ad değiştirilir');
    esit(app.dizimAlaniBul(a1).ad, 'D.A1 Üst', 'yeni ad yazıldı');
    yanlis(app.dizimAlaniAdDegistir(a1, ''), 'boş ada izin verilmez');
    yanlis(app.dizimAlaniAdDegistir('yok', 'X'), 'olmayan alan değiştirilemez');
    app._temizle();
  }
  {
    // Silme: alanın planlardaki girdileri de düşer
    const { app, T, a1, a2 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planAlanGetir(plan, a2);

    dogru(app.dizimAlaniSil(a1), 'alan silinir');
    esit(app.dizimAlaniBul(a1), undefined, 'alan listeden düştü');
    yanlis(plan.alanlar.some(x => x.alanId === a1), 'plandaki atama da düştü');
    dogru(plan.alanlar.some(x => x.alanId === a2), 'diğer alan etkilenmedi');
    yanlis(app.dizimAlaniSil('yok'), 'olmayan alan silinemez');
    app._temizle();
  }

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
    app.planSeciliTarih = T;

    app.planBolmedenKirimAc(a1, b1);
    esit(app.kirimAkisTarlaId, 't0', 'ana tarla plandan geldi');
    esit(app.kirimAkisEkTarlaIds, ['t1'], 'ek tarlalar plandan geldi');
    esit(app.kirimAkisSeraSecimleri.map(x => x.seraId), ['s0','s1'], 'hedef seralar plandan geldi');
    esit(app.kirimAkisSeraSecimleri[0].mod, 'tam', 'seralar tam mod ile gelir');
    esit(app.planKirimBaglami.bolmeId, b1, 'bağlam bölmeyi hatırlar');
    esit(app._belge.getElementById('k2Tarih').value, T, 'kırım tarihi plan tarihine ayarlanır');
    app._temizle();
  }
  {
    // Kayıt oluşunca bölme işaretlenir ve bağlam temizlenir
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planSeciliTarih = T;
    app.planBolmedenKirimAc(a1, b1);

    app.planKirimSonrasiIsaretle('kayit-1');
    esit(app.planBolmeBul(plan, a1, b1).kirimId, 'kayit-1', 'bölme kayda bağlandı');
    esit(app.planKirimBaglami, null, 'bağlam temizlendi');

    // Bağlam yokken çağrı hiçbir bölmeyi bozmaz
    app.planKirimSonrasiIsaretle('kayit-2');
    esit(app.planBolmeBul(plan, a1, b1).kirimId, 'kayit-1', 'bağlamsız çağrı kaydı değiştirmez');
    app._temizle();
  }
  {
    // Girişsiz bölme dönüştürülemez
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planSeciliTarih = T;
    app.planBolmedenKirimAc(a1, b1);
    esit(app.planKirimBaglami, null, 'girişsiz bölme akışı başlatmaz');
    app._temizle();
  }
  {
    // Normal kırım girişi eski bağlamı miras almaz
    const { app, T, a1 } = planOrtami();
    const plan = app.planGetir(T);
    const b1 = app.planAlanGetir(plan, a1).bolmeler[0].id;
    app.planGirisEkle(T, a1, b1, 't0', 'traktor1', 'Ahmet');
    app.planSeciliTarih = T;
    app.planBolmedenKirimAc(a1, b1);
    dogru(!!app.planKirimBaglami, 'bağlam kuruldu');

    app.openKirimModal();
    esit(app.planKirimBaglami, null, 'normal kırım kipi bağlamı sıfırlar');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Saha Planlama — dünü kopyala
     Şoför adı KOPYALANMAZ: her gün değişiyor, kopyalanan ad yanlış bilgi olur.
     Araç ataması kopyalanır — filo sabit.
     --------------------------------------------------------------- */
  bolum('Saha Planlama — dünü kopyala');
  {
    const { app, a1 } = planOrtami();
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
  {
    // Dolu hedefin üzerine yazılmaz
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
  {
    // Kaynak yoksa
    const { app } = planOrtami();
    esit(app.planOncekiDoluTarih('2026-08-05'), null, 'hiç plan yoksa null');
    yanlis(app.planKopyala('2026-08-04', '2026-08-05'), 'olmayan kaynak kopyalanmaz');
    app._temizle();
  }
  {
    // Boşluk atlanır: en son dolu gün bulunur (hafta sonu / yağmur molası)
    const { app, a1 } = planOrtami();
    const eski = '2026-08-01';
    const p = app.planGetir(eski);
    const b = app.planAlanGetir(p, a1).bolmeler[0].id;
    app.planGirisEkle(eski, a1, b, 't0', 'traktor1', 'Ahmet');
    app.planGetir('2026-08-03'); // boş belge: atlanmalı
    esit(app.planOncekiDoluTarih('2026-08-05'), eski, 'aradaki boş günler atlanır');
    app._temizle();
  }

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
      'tarla yok','araç yok','Kaldır','Kırım Kaydına Dönüştür',
      'Araç','Şoför','Şoför adı','Bağla','Uyarı yok.',
      '📋 Dünü Kopyala','⇄ Değiştir','⚙ Dizim Alanları',
      'Yeni Alan Adı','planda kullanılıyor','hiç kullanılmamış','Henüz dizim alanı yok.',
      'Önceki gün','Sonraki gün','Sahadaki 8 dizim alanını oluştur',
      // kart düzeniyle gelen metinler
      'Tarla','Sera','Tarla Bağla','Sera Bağla','Gelen','Giden','Kapat',
      'Başka alanlara çoğalt','Bitir','Kırım kaydına dönüştürüldü',
      'bu girişi indirmek istediğin alanlara dokun.',
      'Takas edilecek ilk öğeye dokun (tarla, sera ya da alan).',
      'Şimdi takas edilecek ikinci öğeye dokun.',
      'Yalnız aynı türden iki öğe takas edilebilir.',
      'Aynı sera birden fazla dizim alanına bağlanabilir.',
      'Önce bir tarla seçin.','Henüz tarla yok.','Henüz sera yok.',
      'Birden fazla tarla seçebilirsin; hepsi aynı araç ve şoförle bağlanır. Aynı tarlayı başka alanlara da bağlayabilirsin.',
      'Seçilenlerin bir kısmı zaten bu bölmedeydi, onlar atlandı.'
    ];
    const eksik = gerekli.filter(k => !(k in app.I18N_EN));
    esit(eksik, [], 'tüm yeni metinlerin İngilizce karşılığı var');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Ödemeler — günlük giriş listesi
     Genel toplam listenin SONUNDA durmalı. Eskiden position:sticky'di ve
     telefonda kalıcı olarak son dayıbaşı kartının üstüne biniyordu; kaydırma
     kabı (.panel-body) hiç kaymadığı için de düzelmiyordu. Buradaki testler
     yerleşimi ölçemez ama iki şeyi bağlar: şerit son kartın ARDINDAN basılır,
     ve bir daha sticky sınıfı almaz.
     --------------------------------------------------------------- */
  bolum('Ödemeler — günlük liste');
  {
    const app = kur();
    ['Ali', 'Veli', 'Zeki'].forEach((ad, i) => app.state.dayibasilar.push({
      id: 'd' + i, ad, bolge: 'tekeliler', aktif: true
    }));
    app.state.yevmiyeKayitlari.push({
      id: 'y0', tarih: app.todayStr(), bolge: 'tekeliler', dayibasiId: 'd2',
      sayilar: { kirim: 3, sulama: 0, dizimAsim: 0, sera: 0, capa: 0 }
    });
    app.odemeBolgeSekmeGecis('tekeliler');
    app.odemeGunlukTarihDegisti(app.todayStr());
    const html = app._belge.getElementById('odemeGunlukListe').innerHTML;

    dogru(html.includes('odeme-genel-toplam-serit'), 'genel toplam şeridi basılır');
    yanlis(html.includes('odeme-genel-toplam-sticky'), 'sticky sınıfı geri gelmemeli');
    // Sıra: son dayıbaşı kartı, şeritten ÖNCE gelmeli.
    dogru(html.lastIndexOf('odeme-kart') < html.indexOf('odeme-genel-toplam-serit'),
      'şerit son dayıbaşı kartının ardından gelir');
    dogru(html.indexOf('Zeki') < html.indexOf('odeme-genel-toplam-serit'),
      'alfabetik son dayıbaşı da şeritten önce');
    app._temizle();
  }
  {
    // Dayıbaşı yoksa şerit hiç basılmaz — boş listenin altında "Genel Toplam: 0"
    // asılı kalması anlamsız olurdu.
    const app = kur();
    app.odemeBolgeSekmeGecis('tekeliler');
    const html = app._belge.getElementById('odemeGunlukListe').innerHTML;
    yanlis(html.includes('odeme-genel-toplam-serit'), 'kayıt yokken şerit basılmaz');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Ortak kırım (aynı gün aynı kodlu tarlalar → TEK kayıt).
     Bu kayıtlarda tarlaId bilerek null, tarlalar tarlaIds'te durur; sadece
     tarlaId'ye bakan her yol bu kayıtları sessizce görmez oluyordu.
     --------------------------------------------------------------- */
  bolum('Ortak kırım — tarlaIds üzerinden okuma');
  {
    const app = kur();
    app.state.tarlalar.push(
      { id: 'T1', ad: 'K1', bolge: 'kalemli', dekar: 10, cesit: 'Basma', viyolDekar: 10, yerOcagiDekar: 0 },
      { id: 'T2', ad: 'K2', bolge: 'kalemli', dekar: 10, cesit: 'Basma', viyolDekar: 8, yerOcagiDekar: 0 },
      { id: 'T3', ad: 'K3', bolge: 'kalemli', dekar: 10, cesit: 'Basma', viyolDekar: 0, yerOcagiDekar: 9 }
    );
    app.state.kirimlar.push({
      id: 'KR1', tarih: app.todayStr(), tarlaId: null, tarlaIds: ['T1', 'T2'],
      cesit: 'Basma', kirimNo: 1, diziSayisi: 800, ortDiziKg: 3.5,
      seraDagilimi: [], olusturma: Date.now()
    });
    const b = app._belge;
    b.getElementById('statBaslangic').value = '';
    b.getElementById('statBitis').value = '';
    b.getElementById('statCesit').value = '';
    b.getElementById('statTarlaAra').value = 'K1';
    app.renderToplamIstatistik();
    dogru(b.getElementById('toplamIstatistikListe').innerHTML.includes('K1'),
      'tarla araması ortak kırımı bulur (tek tarlaya bakıp elemez)');

    b.getElementById('statTarlaAra').value = 'K9';
    app.renderToplamIstatistik();
    yanlis(b.getElementById('toplamIstatistikListe').innerHTML.includes('K1'),
      'ilgisiz tarla araması ortak kırımı getirmez');

    // Fide tipi: iki tarla da viyol → viyol; farklı yöntemler → karma (seçim istenir)
    esit(app.kaynakFideTipi({ tarlaId: null, tarlaIds: ['T1', 'T2'] }).tip, 'viyol',
      'ortak kırımda ikisi de viyolse fide tipi viyol');
    esit(app.kaynakFideTipi({ tarlaId: 'T1', tarlaIds: ['T1'] }).tip, 'viyol',
      'tek tarlada türetme bozulmadı');
    const karisik = app.kaynakFideTipi({ tarlaId: null, tarlaIds: ['T1', 'T3'] });
    esit(karisik.tip, 'karma', 'tarlalar farklı yöntem kullanıyorsa karma');
    dogru(karisik.secimGerekli, 'karma çıkınca kullanıcıdan seçim istenir');
    esit(app.kaynakFideTipi({ tarlaId: null, tarlaIds: [] }).tip, null,
      'tarlası bilinmeyen partide tip null kalır');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Plandan üretilen kırım silinince plandaki bağ da kopmalı. Kopmazsa bölme
     "zaten dönüştürülmüş" sayılıp bir daha kayıt açtırmaz ve çalışma işareti
     ortada kayıt yokken kapalı kalır.
     --------------------------------------------------------------- */
  bolum('Plan ↔ kırım bağı');
  {
    const app = kur();
    app.dizimAlanlariTohumla();
    app.state.tarlalar.push({ id: 'T1', ad: 'K1', dekar: 10, cesit: 'Basma' });
    const alanId = app.state.dizimAlanlari[0].id;
    const bugun = app.todayStr();
    app.planBolmeEkle(bugun, alanId);
    const bolmeId = app.planBul(bugun).alanlar.find(a => a.alanId === alanId).bolmeler[0].id;
    app.planGirisEkle(bugun, alanId, bolmeId, 'T1', 'traktor1', 'Ali');
    app.state.kirimlar.push({
      id: 'KR1', tarih: bugun, tarlaId: 'T1', tarlaIds: ['T1'], cesit: 'Basma',
      kirimNo: 1, diziSayisi: 400, ortDiziKg: 3.5, seraDagilimi: [], olusturma: Date.now()
    });
    app.planKirimBaglami = { tarih: bugun, alanId, bolmeId };
    app.planKirimSonrasiIsaretle('KR1');
    esit(app.planBolmeBul(app.planBul(bugun), alanId, bolmeId).kirimId, 'KR1',
      'bölme kırım kaydına bağlanır');
    yanlis(app.bugunPlanTarlaIdleri().includes('T1'),
      'kayda dönüşmüş bölme çalışma işareti üretmez');

    app.kirimSil('KR1');
    esit(app.planBolmeBul(app.planBul(bugun), alanId, bolmeId).kirimId, null,
      'kayıt silinince bölmenin bağı kopar');
    dogru(app.bugunPlanTarlaIdleri().includes('T1'),
      'bağ kopunca çalışma işareti yeniden doğar');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Rapor: bölge grafiğinin toplamı, üstteki "Gerçekleşen Hasat" ile TUTMALI.
     Bölgesiz tarla ve tarlası belirtilmemiş kayıt grafikten düşerse iki sayı
     birbirini tutmuyor ve kullanıcı hangisine güveneceğini bilemiyor.
     --------------------------------------------------------------- */
  bolum('Rapor — bölge grafiği toplamı');
  {
    const app = kur();
    app.state.tarlalar.push(
      { id: 'T1', ad: 'T1', bolge: 'tekeliler', dekar: 10 },
      { id: 'K1', ad: 'K1', bolge: 'kalemli', dekar: 10 },
      { id: 'B1', ad: 'B1', bolge: '', dekar: 10 }            // bölgesi girilmemiş
    );
    const g = app.todayStr();
    const kirim = (id, tarlaIds, dizi) => ({
      id, tarih: g, tarlaId: tarlaIds.length === 1 ? tarlaIds[0] : null, tarlaIds,
      cesit: 'Basma', kirimNo: 1, diziSayisi: dizi, ortDiziKg: 1, seraDagilimi: [], olusturma: Date.now()
    });
    app.state.kirimlar.push(
      kirim('a', ['T1'], 100),
      kirim('b', ['K1'], 200),
      kirim('c', ['B1'], 40),   // bölgesiz tarla
      kirim('d', [], 7)         // tarlası hiç belirtilmemiş
    );
    app.renderRapor();
    const ozet = app._belge.getElementById('raporOzet').innerHTML;
    const cikti = app._belge.getElementById('raporBolgeChart').innerHTML;
    const sayilar = (cikti.match(/bar-value">([\d.,]+)</g) || [])
      .map(s => Number(s.replace(/\D/g, '')));
    const grafikToplam = sayilar.reduce((a, b) => a + b, 0);
    esit(grafikToplam, 347, 'grafik çubukları toplamı gerçekleşen hasadın tamamını kapsar');
    dogru(ozet.includes('347'), '"Gerçekleşen Hasat" da aynı toplamı gösterir');
    dogru(cikti.includes('Diğer'), 'bölgesiz kg için üçüncü çubuk açılır');
    app._temizle();
  }
  {
    // Bölgesiz kg yoksa üçüncü çubuk hiç çıkmamalı: boş bir "Diğer: 0" satırı gürültü.
    const app = kur();
    app.state.tarlalar.push({ id: 'T1', ad: 'T1', bolge: 'tekeliler', dekar: 10 });
    app.state.kirimlar.push({
      id: 'a', tarih: app.todayStr(), tarlaId: 'T1', tarlaIds: ['T1'], cesit: 'Basma',
      kirimNo: 1, diziSayisi: 100, ortDiziKg: 1, seraDagilimi: [], olusturma: Date.now()
    });
    app.renderRapor();
    yanlis(app._belge.getElementById('raporBolgeChart').innerHTML.includes('Diğer'),
      'bölgesiz kg yokken üçüncü çubuk basılmaz');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Plan çöp toplama ve yetim referanslar. Plan belgesi yalnızca gerçekten
     bir şey bağlandığında yaşamalı; silinen tarla/sera de plandan düşmeli.
     --------------------------------------------------------------- */
  bolum('Plan — çöp belge ve yetim referans');
  {
    const app = kur();
    app.dizimAlanlariTohumla();
    const [a, b] = app.state.dizimAlanlari.map(x => x.id);
    yanlis(app.planAlanTakas(app.todayStr(), a, b), 'iki boş alanın takası değişiklik saymaz');
    esit(app.state.sahaPlanlari.length, 0, 'boş alan takası plan belgesi yaratmaz');

    // İçi dolu bir alanla takas hâlâ çalışmalı
    app.state.tarlalar.push({ id: 'T1', ad: 'K1', dekar: 10, cesit: 'Basma' });
    const bugun = app.todayStr();
    app.planGirisEkle(bugun, a, app.planIlkBolmeId(a), 'T1', 'traktor1', 'Ali');
    dogru(app.planAlanTakas(bugun, a, b), 'dolu alanın takası uygulanır');
    const alanB = app.planBul(bugun).alanlar.find(x => x.alanId === b);
    esit(alanB.bolmeler[0].girisler[0].tarlaId, 'T1', 'giriş hedef alana taşınır');
    app._temizle();
  }
  {
    // "Böl" işlemi o gün üzerinde çalışılırken yaşar, günden ayrılınca toplanır.
    const app = kur();
    app.dizimAlanlariTohumla();
    const alanId = app.state.dizimAlanlari[0].id;
    app.planBolmeEkleTikla(alanId);
    esit(app.planBul(app.todayStr()).alanlar[0].bolmeler.length, 2,
      'bölme eklenince düzen o gün için yaşar');
    app.planTarihSecildi('2026-01-15');
    esit(app.state.sahaPlanlari.length, 0, 'günden ayrılınca boş plan belgesi toplanır');
    app._temizle();
  }
  {
    const app = kur();
    app.dizimAlanlariTohumla();
    app.state.tarlalar.push({ id: 'T1', ad: 'K1', dekar: 10, cesit: 'Basma' });
    app.state.seralar.push({ id: 'S1', ad: 'B1', kapasite: 400, bolge: 'kalemli', donemler: [] });
    const alanId = app.state.dizimAlanlari[0].id;
    const bugun = app.todayStr();
    const bolmeId = app.planIlkBolmeId(alanId);
    app.planGirisEkle(bugun, alanId, bolmeId, 'T1', 'traktor1', 'Ali');
    app.planSeraEkle(bugun, alanId, bolmeId, 'S1');

    app.tarlaSil('T1');
    esit(app.planBolmeBul(app.planBul(bugun), alanId, bolmeId).girisler.length, 0,
      'silinen tarla plandan da düşer');
    app.seraSil('S1');
    const kalan = app.planBul(bugun);
    esit(kalan ? app.planBolmeBul(kalan, alanId, bolmeId).seraIds.length : 0, 0,
      'silinen sera plandan da düşer');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Kroki: sera kutusu genişliği artık kapasiteden türemiyor.
     Eski formül (kapasite/480)x40px, 200 dizilik serayı 17px'e indiriyor ve
     etiketi ekranda "8." olarak bırakıyordu.
     --------------------------------------------------------------- */
  bolum('Kroki — sera kutusu eşit genişlik');
  {
    const app = kur();
    app.state.seralar.push(
      { id: 's1', ad: '80 cm', bolge: 'kalemli', kapasite: 200, donemler: [] },
      { id: 's2', ad: 'B1', bolge: 'kalemli', kapasite: 400, donemler: [] }
    );
    app.renderSeralar();
    const html = app._belge.getElementById('seraPlot').innerHTML;
    yanlis(/style="width:/.test(html), 'kutu genişliği artık satır içi stille yazılmaz');
    dogru(html.includes('80 cm'), 'düşük kapasiteli sera yine çizilir');
    dogru(html.includes('B1'), 'normal sera yine çizilir');
    app._temizle();
  }
  {
    /* Boşluksuz uzun ad iki satıra inemez (bölünecek yer yok) — tek kademe
       küçülerek tek satırda kalır. Boşluklu adlar sarıldığı için küçülmez. */
    const app = kur();
    app.state.seralar.push(
      { id: 's1', ad: '100cm', bolge: 'kalemli', kapasite: 400, donemler: [] },
      { id: 's2', ad: '80 cm', bolge: 'kalemli', kapasite: 200, donemler: [] },
      { id: 's3', ad: 'B1', bolge: 'kalemli', kapasite: 400, donemler: [] }
    );
    app.renderSeralar();
    const html = app._belge.getElementById('seraPlot').innerHTML;
    const sinif = ad => {
      const m = html.match(new RegExp('<div class="label([^"]*)">' + ad + '<'));
      return m ? m[1].trim() : '(bulunamadı)';
    };
    esit(sinif('100cm'), 'uzun-ad', 'boşluksuz uzun ad küçük puntoya düşer');
    esit(sinif('80 cm'), '', 'boşluklu ad küçülmez, sarılır');
    esit(sinif('B1'), '', 'kısa ad küçülmez');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Uzun basma ile silme. Izgaradaki × düğmeleri kaldırıldı; silme artık
     basılı tutmayı istiyor. Onay + geri alma zinciri değişmedi.
     --------------------------------------------------------------- */
  bolum('Kroki — uzun basma ile silme');
  function sahteKutu() {
    return { classList: { _k: new Set(),
      add(c) { this._k.add(c); }, remove(c) { this._k.delete(c); },
      contains(c) { return this._k.has(c); } } };
  }
  {
    const app = kur();
    const el = sahteKutu();
    let calisti = 0;
    app.uzunBasmaBaslat(el, () => calisti++);
    dogru(el.classList.contains('uzun-basiliyor'), 'basarken ilerleme sınıfı eklenir');
    app.uzunBasmaIptal();
    yanlis(el.classList.contains('uzun-basiliyor'), 'bırakınca ilerleme sınıfı kalkar');
    esit(calisti, 0, 'süre dolmadan silme çalışmaz');
    yanlis(app.uzunBasmaTiklamaYutuldu(), 'iptal edilen basma tıklamayı yutmaz');
    app._temizle();
  }
  {
    // tests/run.js async IIFE; harness gerçek zamanlayıcı kullandığı için
    // gerçekten bekliyoruz. Tek seferlik ~530ms, harness'a dokunmaktan ucuz.
    const app = kur();
    const el = sahteKutu();
    let calisti = 0;
    app.uzunBasmaBaslat(el, () => calisti++);
    await new Promise(r => setTimeout(r, app.UZUN_BASMA_MS + 40));
    esit(calisti, 1, 'süre dolunca silme çalışır');
    yanlis(el.classList.contains('uzun-basiliyor'), 'tetiklenince ilerleme sınıfı kalkar');
    dogru(app.uzunBasmaTiklamaYutuldu(), 'tetiklenen basma takip eden tıklamayı yutar');
    yanlis(app.uzunBasmaTiklamaYutuldu(), 'yutma tek seferliktir');
    app._temizle();
  }
  {
    // İkinci basma birincisini iptal etmeli; yoksa iki sayaç birden dolar.
    const app = kur();
    const a = sahteKutu(), b = sahteKutu();
    let ilk = 0, ikinci = 0;
    app.uzunBasmaBaslat(a, () => ilk++);
    app.uzunBasmaBaslat(b, () => ikinci++);
    yanlis(a.classList.contains('uzun-basiliyor'), 'yeni basma öncekinin işaretini siler');
    await new Promise(r => setTimeout(r, app.UZUN_BASMA_MS + 40));
    esit(ilk, 0, 'iptal edilen ilk basma çalışmaz');
    esit(ikinci, 1, 'yalnızca son basma çalışır');
    app._temizle();
  }
  {
    // Izgarada × düğmesi kalmamalı — silme yolu artık uzun basma.
    const app = kur();
    app.state.seralar.push({ id: 's1', ad: 'B1', bolge: 'kalemli', kapasite: 400, donemler: [] });
    app.state.tarlalar.push({ id: 't1', ad: 'K1', bolge: 'kalemli', dekar: 10, cesit: 'Basma' });
    app.renderSeralar();
    app.renderTarlalar();
    const seraHtml = app._belge.getElementById('seraPlot').innerHTML;
    const tarlaHtml = app._belge.getElementById('tarlaPlot').innerHTML;
    yanlis(seraHtml.includes('sera-close'), 'sera kutusunda × düğmesi kalmadı');
    yanlis(tarlaHtml.includes('tarla-close'), 'tarla kutusunda × düğmesi kalmadı');
    dogru(seraHtml.includes('uzunBasmaBaslat'), 'sera kutusu uzun basmaya bağlı');
    dogru(tarlaHtml.includes('uzunBasmaBaslat'), 'tarla kutusu uzun basmaya bağlı');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Senkron vurgusu: başka bir cihazdan gelen değişim kısa süre işaretlenir.
     Eşik, içe aktarma gibi toplu olaylarda 148 kutunun birden yanmasını önler.
     --------------------------------------------------------------- */
  bolum('Senkron vurgusu');
  {
    const app = kur();
    dogru(app.degisimIsaretle(['a', 'b']), 'az sayıda değişim işaretlenir');
    esit(app.degisimSinifi('a'), ' yeni-degisti', 'işaretli kayıt sınıf alır');
    esit(app.degisimSinifi('c'), '', 'işaretsiz kayıt sınıf almaz');
    yanlis(app.degisimIsaretle([]), 'boş liste işaretlenmez');
    app._temizle();
  }
  {
    // Toplu değişim (içe aktarma / yedek geri yükleme) tek tek vurgulanmaz.
    const app = kur();
    const cok = Array.from({ length: app.VURGU_EN_COK + 1 }, (_, i) => 'x' + i);
    yanlis(app.degisimIsaretle(cok), 'eşiği aşan toplu değişim işaretlenmez');
    esit(app.degisimSinifi('x0'), '', 'toplu değişimde tek tek vurgu yok');
    // Eşiğin tam üstünde hâlâ çalışmalı
    const tam = Array.from({ length: app.VURGU_EN_COK }, (_, i) => 'y' + i);
    dogru(app.degisimIsaretle(tam), 'eşiğe eşit sayıda değişim işaretlenir');
    app._temizle();
  }
  {
    // Süre aşımı beklemeden sınanır: degisimTaze zamanı parametre alıyor.
    const app = kur();
    app.degisimIsaretle(['a']);
    dogru(app.degisimTaze('a', Date.now()), 'taze vurgu ayakta');
    yanlis(app.degisimTaze('a', Date.now() + app.VURGU_SURE_MS + 100), 'süresi dolan vurgu düşer');
    esit(app.degisimSinifi('a'), '', 'süresi dolan kayıt artık sınıf almaz');
    app._temizle();
  }
  {
    // Uzaktan değişen sera kutusu işaretlenir; diğerleri sade kalır.
    const app = kur();
    app.state.seralar.push(
      { id: 's1', ad: 'B1', bolge: 'kalemli', kapasite: 400, donemler: [] },
      { id: 's2', ad: 'B2', bolge: 'kalemli', kapasite: 400, donemler: [] }
    );
    app.degisimIsaretle(['s1']);
    app.renderSeralar();
    const html = app._belge.getElementById('seraPlot').innerHTML;
    /* Kutu kutu bakılır. Öznitelik içindeki ()=> okları > karakteri taşıdığı
       için "aç-kapa arası" regex'leri burada yanıltıyor. */
    const kutular = html.split('<div class="sera-box').slice(1);
    const kutu = ad => kutular.find(k => k.includes('>' + ad + '<')) || '';
    esit(kutular.length, 2, 'iki kutu çizildi');
    dogru(kutu('B1').startsWith(' yeni-degisti'), 'uzaktan değişen kutu işaretlenir');
    yanlis(kutu('B2').startsWith(' yeni-degisti'), 'değişmeyen kutu işaretlenmez');
    esit((html.match(/yeni-degisti/g) || []).length, 1, 'yalnızca bir kutu işaretli');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Plan çipi: düzenleme düğmeleri yalnızca AÇIK kartta. Toplanmış kartta
     çoğalt düğmesi 65px'lik çipin 21px'ini alıyor, tarla adına 11px kalıyordu.
     --------------------------------------------------------------- */
  bolum('Plan çipi — düzenleme düğmeleri açık kartta');
  {
    const app = kur();
    app.state.tarlalar.push({ id: 't1', ad: 'K1', bolge: 'kalemli', dekar: 10, cesit: 'Basma' });
    const giris = { tarlaId: 't1', aracId: 'traktor1', sofor: 'Ahmet' };

    const toplanmis = app.planGirisCipHtml('a1', 'b1', giris, false);
    yanlis(toplanmis.includes('class="cogalt"'), 'toplanmış kartta çoğalt düğmesi yok');
    yanlis(toplanmis.includes('class="kaldir"'), 'toplanmış kartta kaldır düğmesi yok');
    dogru(toplanmis.includes('K1'), 'toplanmış kartta ad yazılır');

    const acik = app.planGirisCipHtml('a1', 'b1', giris, true);
    dogru(acik.includes('class="cogalt"'), 'açık kartta çoğalt düğmesi var');
    dogru(acik.includes('class="kaldir"'), 'açık kartta kaldır düğmesi var');
    dogru(acik.includes('Ahmet'), 'açık kartta şoför adı görünür');
    app._temizle();
  }

  /* ---------------------------------------------------------------
     Fotoğraftan aktar
     Kâğıt tabloyu okuyup mevcut aktarım borusuna satır üretme yolu.
     Testlerin ağırlığı SAF denetim fonksiyonlarında: okuma hatalarının
     hangilerinin yakalandığı, hangi satırın uygulanacağı, hangisinin
     atlanacağı. Ağ çağrısı ve ekran ince bir katman.
     --------------------------------------------------------------- */
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

  /* --------------------------------------------------------------- */
  console.log(`\n${'─'.repeat(52)}`);
  if (kalan.length) {
    console.log(`GEÇEN: ${gecen}   KALAN: ${kalan.length}\n`);
    kalan.forEach((k, i) => console.log(`  ${i + 1}) ${k}\n`));
    process.exit(1);
  }
  console.log(`GEÇEN: ${gecen}   KALAN: 0`);
})();

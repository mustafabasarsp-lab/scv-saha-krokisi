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
    const yarin = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return { app, T: yarin, a1: alanlar[0].id, a2: alanlar[1].id };
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
    // Sera tekil sahiplik: ikinci bölmeye eklenince öncekinden düşer
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

  /* --------------------------------------------------------------- */
  console.log(`\n${'─'.repeat(52)}`);
  if (kalan.length) {
    console.log(`GEÇEN: ${gecen}   KALAN: ${kalan.length}\n`);
    kalan.forEach((k, i) => console.log(`  ${i + 1}) ${k}\n`));
    process.exit(1);
  }
  console.log(`GEÇEN: ${gecen}   KALAN: 0`);
})();

/* SCV Saha — fotoğraf okuma aracısı.
 *
 * Neden var: uygulama tek dosyalık statik bir sayfa ve repo herkese açık.
 * API anahtarı istemciye inen HİÇBİR yere konulamaz — koda yazılsa repoda,
 * localStorage'a konsa DevTools'ta, Firestore'a konsa yine tarayıcıda görünür.
 * Bu fonksiyon anahtarı sunucuda tutar: uygulama fotoğrafı buraya yollar,
 * burası Anthropic'e gider ve cevabı olduğu gibi geri verir.
 *
 * Anahtar Secret Manager'da durur, kodda değil:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const ANTHROPIC_ANAHTAR = defineSecret('ANTHROPIC_API_KEY');

/* Sunucu tarafı sınırlar. İstek gövdesini istemci kuruyor (prompt orada
   yaşasın ki her düzeltmede fonksiyon yeniden yayınlanmak zorunda kalmasın),
   ama kritik alanları BURASI dayatıyor — aksi hâlde giriş yapmış biri bu
   fonksiyonu bedava genel amaçlı bir Claude aracısına çevirebilirdi. */
const IZINLI_MODEL = 'claude-opus-5';
const MAX_TOKEN_TAVAN = 32000;
const MAX_GOVDE_BAYT = 12 * 1024 * 1024;   // ~2576px JPEG base64 ≈ 1.7 MB

exports.fotoOku = onCall(
  {
    region: 'europe-west1',        // yükleme gecikmesi: fotoğraf Türkiye'den çıkıyor
    secrets: [ANTHROPIC_ANAHTAR],
    timeoutSeconds: 300,           // yoğun bir tabloda düşünme + okuma uzun sürebiliyor
    memory: '512MiB',
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Bu işlem için uygulamaya giriş yapmalısınız.');
    }

    const govde = request.data && request.data.govde;
    if (!govde || typeof govde !== 'object') {
      throw new HttpsError('invalid-argument', 'İstek gövdesi eksik.');
    }

    const boyut = Buffer.byteLength(JSON.stringify(govde), 'utf8');
    if (boyut > MAX_GOVDE_BAYT) {
      throw new HttpsError('invalid-argument', 'Fotoğraf çok büyük (' + Math.round(boyut / 1048576) + ' MB).');
    }

    /* Tam olarak bir kullanıcı mesajı, içinde bir görüntü olmalı: bu fonksiyon
       yalnızca "fotoğraf oku" işi için var, serbest sohbet için değil. */
    const mesajlar = Array.isArray(govde.messages) ? govde.messages : [];
    if (mesajlar.length !== 1 || mesajlar[0].role !== 'user') {
      throw new HttpsError('invalid-argument', 'Beklenen biçimde bir istek değil.');
    }
    const parcalar = Array.isArray(mesajlar[0].content) ? mesajlar[0].content : [];
    if (!parcalar.some((p) => p && p.type === 'image')) {
      throw new HttpsError('invalid-argument', 'İstekte fotoğraf yok.');
    }
    if (!govde.output_config || !govde.output_config.format) {
      throw new HttpsError('invalid-argument', 'Yapılandırılmış çıktı şeması eksik.');
    }

    // Kritik alanlar istemciden ne gelirse gelsin burada sabitlenir.
    const guvenliGovde = Object.assign({}, govde, {
      model: IZINLI_MODEL,
      max_tokens: Math.min(Number(govde.max_tokens) || MAX_TOKEN_TAVAN, MAX_TOKEN_TAVAN),
      stream: false,
    });

    let cevap;
    try {
      cevap = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_ANAHTAR.value(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(guvenliGovde),
      });
    } catch (e) {
      throw new HttpsError('unavailable', 'Modele ulaşılamadı: ' + (e && e.message));
    }

    const metin = await cevap.text();
    if (!cevap.ok) {
      /* Anthropic'in hata gövdesi anahtarı içermez; kullanıcıya olduğu gibi
         göstermek teşhisi kolaylaştırıyor (400 şema hatası, 401 anahtar,
         429 kota). */
      throw new HttpsError('internal', 'API hatası ' + cevap.status + ': ' + metin.slice(0, 300));
    }

    try {
      return JSON.parse(metin);
    } catch (e) {
      throw new HttpsError('internal', 'Model cevabı çözümlenemedi.');
    }
  }
);

# -*- coding: utf-8 -*-
"""SCV Saha — dar telefon genişliklerinde görsel doğrulama.

Neden var: resize_window tarayıcı penceresini 627px altına indiremiyordu, bu
yüzden 360–390px hiçbir tasarım turunda gözle doğrulanamadı. Playwright
viewport'u doğrudan kurduğu için o boşluk kapanıyor.

Giriş ekranı Firebase'e bağlı; örnek veri localStorage'a yazılır, sayfa
yüklendikten sonra giriş katmanı gizlenip renderAll çağrılır.

Kurulum (bir kereliğine):
    python -m pip install playwright
    python -m playwright install chromium

Kullanım:  python tests/gorsel.py [cikti-dizini]
Çıkış kodu 1 = yatay taşma, etiket kırpılması, sera ızgarası ortalı değil ya da
ayarlar menüsü ekran dışına taşıyor.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parent.parent
CIKTI = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else KOK / "tests" / "_gorsel"
CIKTI.mkdir(parents=True, exist_ok=True)
# 700px bilerek listede: ayarlar menüsü orada başlığın SAĞINDA açılır, dar
# ekranlarda ise solunda. İki yön de sınanmazsa birini düzelten değişiklik
# diğerini sessizce ekran dışına atıyor.
OLCULER = [(360, 740), (390, 844), (430, 932), (700, 900)]


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
                          "girisTarihi": "2026-07-28", "brandaRengi": "beyaz",
                          "aktif": True, "kaynaklar": [], "baslangic": 1, "bitis": None}]
    return d


# En uzun adlar bilerek içeride: kırpılma tam buradan çıkıyor.
STATE = {
    "tarlalar": [tarla(1, "K1", "kalemli", 33), tarla(2, "T2 Yol Üstü", "tekeliler", 23),
                 tarla(3, "T10", "tekeliler", 122), tarla(4, "K26", "kalemli", 75)],
    "seralar": [sera(1, "80 cm", "kalemli", 120, 200), sera(2, "90cm", "kalemli", 0, 240),
                sera(3, "100cm", "kalemli", 285, 400), sera(4, "B1", "kalemli", 400, 400),
                sera(5, "B2", "kalemli", 210, 400), sera(6, "C1", "kalemli", 0, 400),
                sera(7, "C2", "kalemli", 180, 400), sera(8, "D1", "tekeliler", 95, 400)],
    "kirimlar": [], "haritaPinleri": [], "tesisPinleri": [], "depoKutulari": [],
    "sulamaKayitlari": [], "iklimKayitlari": [], "dayibasilar": [],
    "yevmiyeKayitlari": [], "odemeKayitlari": [], "odemeAyarlari": [],
    "dizimAlanlari": [], "sahaPlanlari": [],
}

# Kırpılma METNİN kendi kutusuyla ölçülür (Range), scrollWidth/scrollHeight ile
# değil. Sebebi ölçüldü: `.tarla-box .name::after` etiket katlama üçgeni
# `top:100%` ile kutunun altına taşıyor ve scrollHeight'ı her tarla adında sabit
# 3px şişiriyor (19/16) — dikey kontrol böylece HER adı kırpılmış sanıyordu.
# Range yalnızca metin düğümlerini kapsar, sözde-öğeleri hiç görmez.
OLCUM = """() => {
    const tasma = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const kirpilan = [];
    document.querySelectorAll('.sera-box .label, .tarla-box .name').forEach(el => {
        const cs = getComputedStyle(el);
        const kutu = el.getBoundingClientRect();
        const icGen = kutu.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
                      - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        const icYuk = kutu.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
                      - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
        const aralik = document.createRange();
        aralik.selectNodeContents(el);
        const metin = aralik.getBoundingClientRect();
        if (metin.width > icGen + 1 || metin.height > icYuk + 1) {
            kirpilan.push(el.textContent.trim());
        }
    });
    const ilkKutu = document.querySelector('.sera-box');

    // Sera/tarla ızgaraları: kutu genişliği sabit olduğu için artan pay eskiden
    // hep sağda birikiyordu (ölçüldü: sera 390px'te 34px, tarla 73px). Her
    // SATIRIN iki yanındaki boşluk eşit mi diye bakılır; en büyük fark döner.
    const izgaraKacik = (kapSec, kutuSec) => {
        const plot = document.querySelector(kapSec);
        if (!plot) return 0;
        const pk = plot.getBoundingClientRect();
        const satirlar = new Map();
        plot.querySelectorAll(kutuSec).forEach(b => {
            const q = b.getBoundingClientRect();
            const s = satirlar.get(Math.round(q.top)) || { sol: Infinity, sag: -Infinity };
            s.sol = Math.min(s.sol, q.left);
            s.sag = Math.max(s.sag, q.right);
            satirlar.set(Math.round(q.top), s);
        });
        let en = 0;
        satirlar.forEach(s => {
            en = Math.max(en, Math.abs((s.sol - pk.left) - (pk.right - s.sag)));
        });
        return Math.round(en);
    };
    const seraKacik = izgaraKacik('.sera-plot', '.sera-box');
    const tarlaKacik = izgaraKacik('.tarla-plot', '.tarla-box');

    // Rozet ipuçları: .badges şeridi overflow-x:auto ile kaydırma kabı olduğu
    // için ipucunun taşan kısmı kırpılıyordu (ölçüldü: 46-329px) ve sağdaki
    // rozetlerde ipucu ekranın da dışına çıkıyordu. Hem ekran hem de kırpan
    // ata denetleniyor — birini düzeltip diğerini kaçırmak mümkün.
    let rozetTasma = 0, rozetSayisi = 0;
    document.querySelectorAll('.badge').forEach(rozet => {
        if (typeof rozetTikla !== 'function') return;
        rozetTikla({ stopPropagation(){} }, rozet);
        const ipucu = rozet.querySelector('.badge-tip');
        if (ipucu) {
            const q = ipucu.getBoundingClientRect();
            rozetTasma = Math.max(rozetTasma, -q.left, q.right - document.documentElement.clientWidth,
                                  -q.top, q.bottom - document.documentElement.clientHeight);
            // Kırpan ata: fixed kutuyu overflow'lu ata kırpmaz, absolute'u kırpar.
            if (getComputedStyle(ipucu).position !== 'fixed') {
                let p = ipucu.parentElement;
                while (p && p !== document.body) {
                    const pcs = getComputedStyle(p);
                    if (pcs.overflowX !== 'visible' || pcs.overflowY !== 'visible') {
                        const kt = p.getBoundingClientRect();
                        rozetTasma = Math.max(rozetTasma, kt.left - q.left, q.right - kt.right,
                                              kt.top - q.top, q.bottom - kt.bottom);
                        break;
                    }
                    p = p.parentElement;
                }
            }
            rozetSayisi++;
        }
        rozetTikla({ stopPropagation(){} }, rozet);
    });
    rozetTasma = Math.round(Math.max(0, rozetTasma));

    // Ayarlar menüsü açıkken tamamı ekranda mı?
    const menu = document.getElementById('ayarMenu');
    let menuTasma = 0, menuOlculdu = false;
    if (menu && typeof ayarMenusuAcKapa === 'function') {
        ayarMenusuAcKapa({ stopPropagation(){} });
        const govde = menu.querySelector('.ayar-menu-govde');
        if (getComputedStyle(govde).position === 'absolute') {
            const g = govde.getBoundingClientRect();
            menuTasma = Math.round(Math.max(0, -g.left, g.right - document.documentElement.clientWidth));
            menuOlculdu = true;
        }
        ayarMenusuAcKapa({ stopPropagation(){} });
    }

    return { tasma, kirpilan, seraKacik, tarlaKacik, menuTasma, menuOlculdu,
             rozetTasma, rozetSayisi,
             seraGen: ilkKutu ? Math.round(ilkKutu.getBoundingClientRect().width) : 0 };
}"""

hata = []
with sync_playwright() as p:
    tarayici = p.chromium.launch()
    for genislik, yukseklik in OLCULER:
        for tema in ("light", "dark"):
            sayfa = tarayici.new_page(viewport={"width": genislik, "height": yukseklik},
                                      device_scale_factor=2, is_mobile=True, has_touch=True)
            sayfa.add_init_script(
                "localStorage.setItem('scvSahaKrokiV1', %s);"
                "localStorage.setItem('scvTema', '%s');"
                % (json.dumps(json.dumps(STATE)), tema))
            sayfa.goto((KOK / "scv-saha-v1.html").as_uri())
            sayfa.wait_for_timeout(2500)
            sayfa.evaluate("""() => {
                document.getElementById('loginOverlay').classList.add('hidden');
                if (typeof renderAll === 'function') renderAll();
            }""")
            sayfa.wait_for_timeout(600)
            sayfa.screenshot(path=str(CIKTI / f"scv-{genislik}-{tema}.png"), full_page=True)

            olcum = sayfa.evaluate(OLCUM)
            etiket = f"{genislik}px/{tema}"
            print("%-14s yatay taşma=%dpx  sera kutusu=%dpx  kaçıklık sera/tarla=%d/%dpx  "
                  "ayar menüsü=%s  rozet ipucu taşma=%dpx (%d)  kırpılan=%s"
                  % (etiket, olcum["tasma"], olcum["seraGen"],
                     olcum["seraKacik"], olcum["tarlaKacik"],
                     "%dpx" % olcum["menuTasma"] if olcum["menuOlculdu"] else "ölçülmedi",
                     olcum["rozetTasma"], olcum["rozetSayisi"],
                     olcum["kirpilan"] if olcum["kirpilan"] else "yok"))
            if olcum["tasma"] > 0:
                hata.append("%s: yatay taşma %dpx" % (etiket, olcum["tasma"]))
            if olcum["kirpilan"]:
                hata.append("%s: kırpılan etiket %s" % (etiket, olcum["kirpilan"]))
            # 2px pay: tek sayıda artan pikselin bir yana düşmesi normal.
            for ad, deger in (("sera", olcum["seraKacik"]), ("tarla", olcum["tarlaKacik"])):
                if deger > 2:
                    hata.append("%s: %s ızgarası ortalı değil, yanlar %dpx farklı"
                                % (etiket, ad, deger))
            if olcum["rozetSayisi"] == 0:
                hata.append("%s: rozet ipucu ölçülemedi (rozet yok?)" % etiket)
            elif olcum["rozetTasma"] > 0:
                hata.append("%s: rozet ipucu %dpx kırpılıyor/ekran dışına taşıyor"
                            % (etiket, olcum["rozetTasma"]))
            if not olcum["menuOlculdu"]:
                hata.append("%s: ayarlar menüsü ölçülemedi (açılır menü değil?)" % etiket)
            elif olcum["menuTasma"] > 0:
                hata.append("%s: ayarlar menüsü ekran dışına %dpx taşıyor"
                            % (etiket, olcum["menuTasma"]))
            sayfa.close()
    tarayici.close()

if hata:
    print("\nBAŞARISIZ:")
    for h in hata:
        print("  - " + h)
    sys.exit(1)
print("\nTamam: taşma ve kırpılma yok.")

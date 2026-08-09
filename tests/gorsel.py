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
Çıkış kodu 1 = yatay taşma ya da etiket kırpılması var.
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parent.parent
CIKTI = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else KOK / "tests" / "_gorsel"
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
    return { tasma, kirpilan,
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
            print("%-14s yatay taşma=%dpx  sera kutusu=%dpx  kırpılan=%s"
                  % (etiket, olcum["tasma"], olcum["seraGen"],
                     olcum["kirpilan"] if olcum["kirpilan"] else "yok"))
            if olcum["tasma"] > 0:
                hata.append("%s: yatay taşma %dpx" % (etiket, olcum["tasma"]))
            if olcum["kirpilan"]:
                hata.append("%s: kırpılan etiket %s" % (etiket, olcum["kirpilan"]))
            sayfa.close()
    tarayici.close()

if hata:
    print("\nBAŞARISIZ:")
    for h in hata:
        print("  - " + h)
    sys.exit(1)
print("\nTamam: taşma ve kırpılma yok.")

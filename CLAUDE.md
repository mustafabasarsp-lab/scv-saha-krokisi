# Çalışma Düzeni

**Varsayılan: işi ana oturumda kendin yap.** Alt ajan (`Agent` aracı) çağırma — her ajan sıfırdan başlayıp ~7000 satırlık `scv-saha-v1.html`'i yeniden okuduğu için maliyeti çok yüksek. Kullanıcı açıkça "ekiple yapalım" / "şu ajanı çağır" demedikçe delege etme.

`.claude/agents/` altındaki 8 uzman ajan (`team-lead`, `ux-designer`, `frontend-dev`, `firebase-backend-dev`, `qa-tester`, `release-engineer`, `data-migration`, `terminology-editor`) duruyor ama yalnızca kullanıcı adıyla istediğinde kullanılır.

## Ortam

- `node` kurulu: `C:\Program Files\nodejs\node.exe` (PATH'te).
- **Testler: `node tests/run.js`** — değişiklikten sonra çalıştır. `tests/harness.js` uygulamanın inline `<script>`'ini sahte DOM/localStorage/Firebase ile gerçek bir ortamda çalıştırır, `tests/run.js` iddiaları tutar. Yeni davranış eklerken oraya da bir test ekle; tek seferlik ölçüm/deneme betikleri yine scratchpad'e.
- `gh` CLI **yok**. GitHub işleri için `git` + `curl` kullan.
- Commit'te pre-commit hook `APP_SURUM` ve `sw.js`'teki `CACHE_NAME`'i otomatik artırır — sürümü elle değiştirme.
- **Firebase CLI kurulu ve giriş yapılı** (`firebase`, proje `tarla-app`, `.firebaserc` repoda).
  - `firestore.rules` değişirse: `firebase deploy --only firestore:rules`. **Console'a elle yapıştırma** — 2026-08-10'da elle yapıştırılan kural eksik kaldı, `cesitKodEslemesi` yazması reddedildi ve uygulama bütün senkronu "çevrimdışı" gösterdi. Pre-commit hook yalnızca depodaki dosyayı denetliyor, canlıyla farkı göremez.
  - Fonksiyonlar: `firebase deploy --only functions` (kaynak `functions/`).
  - Gizli anahtarlar Secret Manager'da: `firebase functions:secrets:set ADI`. Fonksiyon anahtarın **belirli bir sürümüne** yayın anında bağlanır; sürüm değişince kaynakta bir şey değiştirip yeniden yayınla, yoksa `deploy` "no changes detected" deyip atlar.

## Codex (angarya işçisi)

Kullanıcının ChatGPT Plus hesabı var; mekanik/iyi tanımlanmış toplu düzenlemeler `codex exec` ile yaptırılabilir (ayrı kota, Claude tokeni harcamaz).

Kural: **Codex'in raporuna asla güvenme, `git diff`'i kendin oku.** Sürümleme, commit, push ve canlı doğrulama her zaman ana oturumda kalır — Codex'e bırakılmaz.

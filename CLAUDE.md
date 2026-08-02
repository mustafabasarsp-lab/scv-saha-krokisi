# Çalışma Düzeni

**Varsayılan: işi ana oturumda kendin yap.** Alt ajan (`Agent` aracı) çağırma — her ajan sıfırdan başlayıp ~7000 satırlık `scv-saha-v1.html`'i yeniden okuduğu için maliyeti çok yüksek. Kullanıcı açıkça "ekiple yapalım" / "şu ajanı çağır" demedikçe delege etme.

`.claude/agents/` altındaki 8 uzman ajan (`team-lead`, `ux-designer`, `frontend-dev`, `firebase-backend-dev`, `qa-tester`, `release-engineer`, `data-migration`, `terminology-editor`) duruyor ama yalnızca kullanıcı adıyla istediğinde kullanılır.

## Ortam

- `node` kurulu: `C:\Program Files\nodejs\node.exe` (PATH'te).
- **Testler: `node tests/run.js`** — değişiklikten sonra çalıştır. `tests/harness.js` uygulamanın inline `<script>`'ini sahte DOM/localStorage/Firebase ile gerçek bir ortamda çalıştırır, `tests/run.js` iddiaları tutar. Yeni davranış eklerken oraya da bir test ekle; tek seferlik ölçüm/deneme betikleri yine scratchpad'e.
- `gh` CLI **yok**. GitHub işleri için `git` + `curl` kullan.
- Commit'te pre-commit hook `APP_SURUM` ve `sw.js`'teki `CACHE_NAME`'i otomatik artırır — sürümü elle değiştirme.
- `firestore.rules` değişirse Firebase Console'dan manuel publish gerekir.

## Codex (angarya işçisi)

Kullanıcının ChatGPT Plus hesabı var; mekanik/iyi tanımlanmış toplu düzenlemeler `codex exec` ile yaptırılabilir (ayrı kota, Claude tokeni harcamaz).

Kural: **Codex'in raporuna asla güvenme, `git diff`'i kendin oku.** Sürümleme, commit, push ve canlı doğrulama her zaman ana oturumda kalır — Codex'e bırakılmaz.

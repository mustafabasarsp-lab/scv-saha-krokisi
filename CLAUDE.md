# Çalışma Düzeni

**Varsayılan: işi ana oturumda kendin yap.** Alt ajan (`Agent` aracı) çağırma — her ajan sıfırdan başlayıp ~7000 satırlık `scv-saha-v1.html`'i yeniden okuduğu için maliyeti çok yüksek. Kullanıcı açıkça "ekiple yapalım" / "şu ajanı çağır" demedikçe delege etme.

`.claude/agents/` altındaki 8 uzman ajan (`team-lead`, `ux-designer`, `frontend-dev`, `firebase-backend-dev`, `qa-tester`, `release-engineer`, `data-migration`, `terminology-editor`) duruyor ama yalnızca kullanıcı adıyla istediğinde kullanılır.

## Ortam

- `node` kurulu: `C:\Program Files\nodejs\node.exe` (PATH'te). Test için standart yöntem: fonksiyonları HTML'den çekip stub'larla çalıştıran geçici Node harness'ı (scratchpad'e yaz, projeye değil).
- `gh` CLI **yok**. GitHub işleri için `git` + `curl` kullan.
- Commit'te pre-commit hook `APP_SURUM` ve `sw.js`'teki `CACHE_NAME`'i otomatik artırır — sürümü elle değiştirme.
- `firestore.rules` değişirse Firebase Console'dan manuel publish gerekir.

## Codex (angarya işçisi)

Kullanıcının ChatGPT Plus hesabı var; mekanik/iyi tanımlanmış toplu düzenlemeler `codex exec` ile yaptırılabilir (ayrı kota, Claude tokeni harcamaz).

Kural: **Codex'in raporuna asla güvenme, `git diff`'i kendin oku.** Sürümleme, commit, push ve canlı doğrulama her zaman ana oturumda kalır — Codex'e bırakılmaz.

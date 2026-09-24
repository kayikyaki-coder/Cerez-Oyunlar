// save.js — localStorage kayıt/yükleme (versiyonlu, try/catch korumalı)

const SAVE_KEY = "tbw_save_v1";
const SAVE_VERSION = 1;

function hasSaveGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return isValidSaveShape(JSON.parse(raw));
  } catch (e) { return false; }
}
// Ham kayıt var ama okunamıyor mu? (bozuk JSON / eski sürüm / eksik alan) — başlık ekranı bunu ayırt eder.
function hasUnreadableSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return true; }
    return !isValidSaveShape(data);
  } catch (e) { return false; }
}

function saveGame() {
  try {
    if (typeof GameState === "undefined") return;
    const payload = Object.assign({ version: SAVE_VERSION }, GameState, { currentBattleNode: null, _partySnapshot: null });
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) { /* localStorage kapalı/dolu olabilir — sessizce yut */ }
}

// Kayıt şeklini doğrular — sürüm eşleşse bile eksik/bozuk alan varsa (elle düzenleme, yarım yazma vb.)
// oyunun ortasında çökmek yerine burada güvenle reddedilir.
function isValidSaveShape(data) {
  if (!data || typeof data !== "object") return false;
  if (data.version !== SAVE_VERSION) return false;
  if (!Array.isArray(data.party)) return false;
  if (typeof data.gold !== "number") return false;
  if (typeof data.chapterIndex !== "number" || typeof data.nodeIndex !== "number") return false;
  return true;
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!isValidSaveShape(data)) return null;
    return data;
  } catch (e) { return null; }
}

function clearSaveGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* yut */ }
}

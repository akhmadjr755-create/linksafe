// ==========================================
// LinkSafe - config.js
// DATA & KONSTANTA (tanpa DOM, tanpa logic)
// Isi identik dengan app.js lama, cuma dipindah.
// ==========================================

export const SCAN_TIMEOUT_MS = 15000; // batas tunggu backend (finite, tidak menggantung)

// Daftar URL shortener yang sering dipakai menyembunyikan tujuan asli
export const SHORTENERS = [
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd'
];

// TLD yang sering disalahgunakan untuk phishing murah
export const RISKY_TLDS = [
    '.xyz', '.top', '.tk', '.ml', '.ga', '.cf', '.gq', '.zip', '.mov'
];

// Kata kunci sensitif yang sering muncul di URL phishing
export const PHISH_KEYWORDS = [
    'login', 'secure', 'update', 'banking', 'verify', 'account', 'wallet'
];

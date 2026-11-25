// ==========================================
// LinkSafe - logic.js
// LOGIC MURNI (tanpa DOM, tanpa jaringan)
// Isi fungsi identik dengan app.js lama.
// ==========================================

import { SHORTENERS, RISKY_TLDS, PHISH_KEYWORDS } from './config.js';

// ---------- Analisis pola URL (dijalankan di browser, tanpa jaringan) ----------
export function analyzeLocalPattern(urlString) {
    let score = 0;
    const reasons = [];
    const url = new URL(urlString); // bisa melempar error -> ditangani pemanggil
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (ipRegex.test(url.hostname)) {
        score += 40;
        reasons.push("Menggunakan alamat IP langsung. Server resmi tidak pernah meminta Anda mengakses via IP.");
    }
    if (urlString.includes('@')) {
        score += 30;
        reasons.push("Karakter '@' terdeteksi. Pola klasik menyembunyikan domain palsu.");
    }

    const parts = url.hostname.split('.');
    if (parts.length > 4) {
        score += 20;
        reasons.push(`Domain memiliki subdomain berlapis (${parts.length - 2}). Sering dipakai untuk membuat link terlihat resmi.`);
    }

    if (SHORTENERS.includes(url.hostname)) {
        score += 15;
        reasons.push("Menggunakan URL Shortener. Tujuan asli disembunyikan.");
    }

    if (RISKY_TLDS.some(tld => url.hostname.endsWith(tld))) {
        score += 20;
        reasons.push("Ekstensi domain (TLD) sering disalahgunakan untuk situs phishing murah.");
    }

    const urlLower = urlString.toLowerCase();
    if (PHISH_KEYWORDS.some(kw => urlLower.includes(kw)) && url.hostname.length > 15) {
        score += 10;
        reasons.push("Mengandung kata kunci sensitif. Pastikan domain utamanya benar-benar resmi.");
    }

    return { score, reasons };
}

// ---------- Aturan label (satu tempat, konsisten) ----------
export function levelFromScore(score) {
    if (score >= 60) return 'bahaya';
    if (score >= 20) return 'waspada';
    return 'aman';
}

export function badgeFor(level, score) {
    switch (level) {
        case 'bahaya': return { cls: 'badge-danger', text: `BAHAYA (${score})` };
        case 'waspada': return { cls: 'badge-warning', text: `WASPADA (${score})` };
        case 'tidak_diketahui': return { cls: 'badge-warning', text: 'TIDAK DIKETAHUI' };
        default: return { cls: 'badge-safe', text: `AMAN (${score})` };
    }
}

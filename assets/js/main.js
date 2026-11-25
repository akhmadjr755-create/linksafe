// ==========================================
// LinkSafe - main.js
// ENTRY POINT: sambung tombol ke logic
// Alur identik dengan app.js lama.
// Tidak daftarkan Enter handler (sudah di animations.js).
// ==========================================

import { analyzeLocalPattern, levelFromScore, badgeFor } from './logic.js';
import { callBackend } from './api.js';
import { showImmediate, resetResultUI, animateResults } from './ui.js';

// ---------- Handler tombol scan ----------
document.getElementById('check-btn').addEventListener('click', async () => {
    const btn = document.getElementById('check-btn');
    const urlInput = document.getElementById('url-input').value.trim();

    // Reset state DOM
    resetResultUI();

    if (!urlInput) {
        showImmediate("ERROR", "badge-warning", ["Target URL tidak boleh kosong."]);
        return;
    }

    let urlString = urlInput;
    if (!/^https?:\/\//i.test(urlString)) {
        urlString = 'http://' + urlString;
    }

    // 1) Analisis pola lokal
    let local;
    try {
        local = analyzeLocalPattern(urlString);
    } catch (error) {
        showImmediate("INVALID FORMAT", "badge-danger", ["Sistem tidak dapat memproses format URL. Pastikan penulisan benar."]);
        return;
    }

    // Kunci tombol selama memindai (mencegah klik ganda)
    const originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'MEMINDAI...';

    try {
        // 2) Panggil backend
        const backend = await callBackend(urlInput);

        if (backend.kind === 'input_error') {
            showImmediate("ERROR", "badge-warning", backend.reasons);
            return;
        }

        // 3) Gabungkan skor
        const lines = [];
        let finalScore = local.score;
        let backendUnknown = true;

        if (backend.kind === 'ok') {
            finalScore = Math.min(100, local.score + (Number(backend.data.score) || 0));
            backendUnknown = backend.data.risk === 'tidak_diketahui';
            (backend.data.reasons || []).forEach(r => lines.push(String(r)));
        } else {
            lines.push(`${backend.message} Hasil di bawah hanya dari analisis pola URL di browser.`);
        }
        local.reasons.forEach(r => lines.push(r));

        let level = levelFromScore(finalScore);
        // Jangan pernah bilang "aman" kalau data keamanan nyata belum ada
        if (level === 'aman' && backendUnknown) {
            level = 'tidak_diketahui';
            lines.push("Belum ada data keamanan yang bisa memastikan link ini aman. Jangan dianggap aman.");
        }

        const badge = badgeFor(level, finalScore);
        animateResults(lines, badge.cls, badge.text);
    } finally {
        btn.disabled = false;
        btn.textContent = originalBtnText;
    }
});

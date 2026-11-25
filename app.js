// ==========================================
// LinkSafe - app.js (TAHAP 1: fungsi tersambung ke backend)
// Alur: input -> analisis pola lokal -> panggil /api/scan -> gabung skor -> tampilkan
// ==========================================

const SCAN_TIMEOUT_MS = 15000; // batas tunggu backend (finite, tidak menggantung)

// ---------- Analisis pola URL (dijalankan di browser, tanpa jaringan) ----------
function analyzeLocalPattern(urlString) {
    let score = 0;
    const reasons = [];
    const url = new URL(urlString); // bisa melempar error -> ditangani pemanggil
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (ipRegex.test(url.hostname)) { score += 40; reasons.push("Menggunakan alamat IP langsung. Server resmi tidak pernah meminta Anda mengakses via IP."); }
    if (urlString.includes('@')) { score += 30; reasons.push("Karakter '@' terdeteksi. Pola klasik menyembunyikan domain palsu."); }

    const parts = url.hostname.split('.');
    if (parts.length > 4) { score += 20; reasons.push(`Domain memiliki subdomain berlapis (${parts.length - 2}). Sering dipakai untuk membuat link terlihat resmi.`); }

    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd'];
    if (shorteners.includes(url.hostname)) { score += 15; reasons.push("Menggunakan URL Shortener. Tujuan asli disembunyikan."); }

    const riskyTlds = ['.xyz', '.top', '.tk', '.ml', '.ga', '.cf', '.gq', '.zip', '.mov'];
    if (riskyTlds.some(tld => url.hostname.endsWith(tld))) { score += 20; reasons.push("Ekstensi domain (TLD) sering disalahgunakan untuk situs phishing murah."); }

    const phishKeywords = ['login', 'secure', 'update', 'banking', 'verify', 'account', 'wallet'];
    const urlLower = urlString.toLowerCase();
    if (phishKeywords.some(kw => urlLower.includes(kw)) && url.hostname.length > 15) { score += 10; reasons.push("Mengandung kata kunci sensitif. Pastikan domain utamanya benar-benar resmi."); }

    return { score, reasons };
}

// ---------- Panggil backend /api/scan ----------
// Mengembalikan salah satu:
//   { kind: 'ok', data }            -> backend membalas normal
//   { kind: 'input_error', reasons } -> backend menolak input (HTTP 400)
//   { kind: 'failed', message }      -> jaringan/server gagal
async function callBackend(urlInput) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    try {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput }),
            signal: controller.signal
        });

        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }

        if (res.status === 400 && data && Array.isArray(data.reasons)) {
            return { kind: 'input_error', reasons: data.reasons };
        }
        if (!res.ok || !data || !Array.isArray(data.sources_checked)) {
            return { kind: 'failed', message: `Server pemindai tidak membalas dengan benar (HTTP ${res.status}).` };
        }
        return { kind: 'ok', data };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { kind: 'failed', message: 'Server pemindai terlalu lama membalas (timeout).' };
        }
        return { kind: 'failed', message: 'Tidak bisa menghubungi server pemindai.' };
    } finally {
        clearTimeout(timer);
    }
}

// ---------- Aturan label (satu tempat, konsisten) ----------
function levelFromScore(score) {
    if (score >= 60) return 'bahaya';
    if (score >= 20) return 'waspada';
    return 'aman';
}

function badgeFor(level, score) {
    switch (level) {
        case 'bahaya': return { cls: 'badge-danger', text: `BAHAYA (${score})` };
        case 'waspada': return { cls: 'badge-warning', text: `WASPADA (${score})` };
        case 'tidak_diketahui': return { cls: 'badge-warning', text: 'TIDAK DIKETAHUI' };
        default: return { cls: 'badge-safe', text: `AMAN (${score})` };
    }
}

// ---------- Tampilan error cepat (tanpa animasi) ----------
function showImmediate(badgeText, badgeClass, lines) {
    const resultContainer = document.getElementById('result-container');
    const riskBadge = document.getElementById('risk-badge');
    const reasonList = document.getElementById('reason-list');

    reasonList.innerHTML = '';
    riskBadge.textContent = badgeText;
    riskBadge.className = badgeClass;
    riskBadge.style.opacity = '1';
    lines.forEach(line => {
        const li = document.createElement('li');
        li.textContent = line;
        reasonList.appendChild(li);
    });
    resultContainer.classList.remove('result-hidden');
    resultContainer.classList.add('result-visible');
}

// ---------- Handler tombol scan ----------
document.getElementById('check-btn').addEventListener('click', async () => {
    const btn = document.getElementById('check-btn');
    const urlInput = document.getElementById('url-input').value.trim();
    const resultContainer = document.getElementById('result-container');
    const riskBadge = document.getElementById('risk-badge');
    const reasonList = document.getElementById('reason-list');

    // Reset state DOM
    reasonList.innerHTML = '';
    resultContainer.classList.remove('result-visible');
    resultContainer.classList.add('result-hidden');
    riskBadge.className = '';
    riskBadge.style.opacity = '0';

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

// ==========================================
// FUNGSI ANIMASI (FINITE & KONSISTEN) - tidak diubah
// ==========================================
function animateResults(lines, badgeClass, badgeText) {
    const resultContainer = document.getElementById('result-container');
    const reasonList = document.getElementById('reason-list');
    const riskBadge = document.getElementById('risk-badge');

    // Cek preferensi reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. TAMPILKAN KARTU (Fade & Slide)
    resultContainer.classList.remove('result-hidden');
    // Sedikit delay agar browser render display:block dulu sebelum transisi opacity
    setTimeout(() => {
        resultContainer.classList.add('result-visible');
    }, 50);

    if (prefersReducedMotion) {
        // JIKA USER GAK SUKA ANIMASI: Langsung tampil semua
        lines.forEach(line => {
            const li = document.createElement('li');
            li.textContent = line;
            reasonList.appendChild(li);
        });
        riskBadge.textContent = badgeText;
        riskBadge.className = badgeClass;
        riskBadge.style.opacity = '1';
        return;
    }

    // 2. EFEK MENGETIK BARIS PER BARIS (Finite & Terkontrol)
    let currentLine = 0;
    let currentChar = 0;
    let textTimer;

    function typeNextChar() {
        if (currentLine >= lines.length) {
            // SELESAI NGITIK: Munculkan Badge
            clearTimeout(textTimer);
            riskBadge.textContent = badgeText;
            riskBadge.className = badgeClass;
            riskBadge.style.opacity = '1';
            // Trigger animasi pop CSS
            riskBadge.classList.add('badge-pop');
            return;
        }

        let currentLi = reasonList.children[currentLine];

        // Kalau baris baru, bikin <li> kosong dulu
        if (!currentLi) {
            currentLi = document.createElement('li');
            reasonList.appendChild(currentLi);
            currentChar = 0;
        }

        // Ketik 1 karakter
        const text = lines[currentLine];
        currentLi.textContent = text.substring(0, currentChar + 1);
        currentChar++;

        if (currentChar < text.length) {
            // Masih ada karakter di baris ini, lanjut ngetik
            textTimer = setTimeout(typeNextChar, 20); // 20ms per karakter
        } else {
            // Baris ini selesai, pindah ke baris berikutnya (jeda dikit)
            currentLine++;
            textTimer = setTimeout(typeNextChar, 100); // 100ms jeda antar baris
        }
    }

    // Mulai animasi mengetik setelah kartu muncul
    textTimer = setTimeout(typeNextChar, 300);
}

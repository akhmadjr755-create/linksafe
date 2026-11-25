// ==========================================
// LinkSafe - ui.js
// KABEL PENGHUBUNG: DOM manipulation & animasi
// id/class SAMA PERSIS dengan HTML Qwen.
// Tidak duplikat Enter handler (sudah di animations.js).
// Tidak sentuh theme-toggle (sudah di animations.js).
// ==========================================

// ---------- Tampilan error cepat (tanpa animasi) ----------
export function showImmediate(badgeText, badgeClass, lines) {
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

// ---------- Reset state DOM sebelum scan baru ----------
export function resetResultUI() {
    const resultContainer = document.getElementById('result-container');
    const riskBadge = document.getElementById('risk-badge');
    const reasonList = document.getElementById('reason-list');

    reasonList.innerHTML = '';
    resultContainer.classList.remove('result-visible');
    resultContainer.classList.add('result-hidden');
    riskBadge.className = '';
    riskBadge.style.opacity = '0';
}

// ---------- Fungsi animasi (FINITE & KONSISTEN) ----------
export function animateResults(lines, badgeClass, badgeText) {
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

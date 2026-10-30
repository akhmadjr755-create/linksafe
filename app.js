document.getElementById('check-btn').addEventListener('click', () => {
    let urlInput = document.getElementById('url-input').value.trim();
    const resultContainer = document.getElementById('result-container');
    const riskBadge = document.getElementById('risk-badge');
    const reasonList = document.getElementById('reason-list');

    // Reset state DOM
    reasonList.innerHTML = '';
    resultContainer.classList.remove('result-visible');
    resultContainer.classList.add('result-hidden');
    riskBadge.className = ''; // Hapus class warna lama
    riskBadge.style.opacity = '0'; // Sembunyikan badge dulu

    if (!urlInput) {
        riskBadge.textContent = "ERROR";
        riskBadge.className = "badge-warning";
        riskBadge.style.opacity = '1';
        reasonList.innerHTML = "<li>Target URL tidak boleh kosong.</li>";
        resultContainer.classList.remove('result-hidden');
        resultContainer.classList.add('result-visible');
        return;
    }

    let riskScore = 0;
    let reasons = [];

    let urlString = urlInput;
    if (!/^https?:\/\//i.test(urlString)) {
        urlString = 'http://' + urlString;
    }

    try {
        const url = new URL(urlString);
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        
        if (ipRegex.test(url.hostname)) { riskScore += 40; reasons.push("Menggunakan alamat IP langsung. Server resmi tidak pernah meminta Anda mengakses via IP."); }
        if (urlString.includes('@')) { riskScore += 30; reasons.push("Karakter '@' terdeteksi. Pola klasik menyembunyikan domain palsu."); }
        
        const parts = url.hostname.split('.');
        if (parts.length > 4) { riskScore += 20; reasons.push(`Domain memiliki subdomain berlapis (${parts.length - 2}). Sering dipakai untuk membuat link terlihat resmi.`); }

        const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd'];
        if (shorteners.includes(url.hostname)) { riskScore += 15; reasons.push("Menggunakan URL Shortener. Tujuan asli disembunyikan."); }

        const riskyTlds = ['.xyz', '.top', '.tk', '.ml', '.ga', '.cf', '.gq', '.zip', '.mov'];
        if (riskyTlds.some(tld => url.hostname.endsWith(tld))) { riskScore += 20; reasons.push("Ekstensi domain (TLD) sering disalahgunakan untuk situs phishing murah."); }

        const phishKeywords = ['login', 'secure', 'update', 'banking', 'verify', 'account', 'wallet'];
        const urlLower = urlString.toLowerCase();
        if (phishKeywords.some(kw => urlLower.includes(kw)) && url.hostname.length > 15) { riskScore += 10; reasons.push("Mengandung kata kunci sensitif. Pastikan domain utamanya benar-benar resmi."); }

        if (reasons.length === 0) {
            reasons.push("Tidak ada indikator pola URL berbahaya yang terdeteksi.");
            reasons.push("Selalu periksa kembali apakah tampilan situsnya asli.");
        }

        let badgeClass = "badge-safe";
        let badgeText = `LOW RISK (${riskScore})`;
        
        if (riskScore >= 50) { badgeClass = "badge-danger"; badgeText = `HIGH RISK (${riskScore})`; }
        else if (riskScore >= 20) { badgeClass = "badge-warning"; badgeText = `WARNING (${riskScore})`; }

        // PANGGIL FUNGSI ANIMASI (Sistematis & Terstruktur)
        animateResults(reasons, badgeClass, badgeText);

    } catch (error) {
        riskBadge.textContent = "INVALID FORMAT";
        riskBadge.className = "badge-danger";
        riskBadge.style.opacity = '1';
        const errLi = document.createElement('li');
        errLi.textContent = "Sistem tidak dapat memproses format URL. Pastikan penulisan benar.";
        reasonList.appendChild(errLi);
        
        resultContainer.classList.remove('result-hidden');
        resultContainer.classList.add('result-visible');
    }
});

// ==========================================
// FUNGSI ANIMASI (FINITE & KONSISTEN)
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

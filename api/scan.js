// api/scan.js
// LinkSafe Backend - Penggabungan Safe Browsing & VirusTotal

const createResponse = (url, risk, score, reasons, sources_checked = [], sources_failed = []) => {
    return { url: url || "", risk, score, reasons, sources_checked, sources_failed };
};

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new Error('Timeout');
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json(createResponse("", "error", 0, ["Metode HTTP tidak diizinkan. Gunakan POST."]));
    }

    let { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json(createResponse("", "error", 0, ["Input URL kosong atau format tidak valid."]));
    }

    url = url.trim();
    if (url.length > 2048) {
        return res.status(400).json(createResponse("", "error", 0, ["URL terlalu panjang (maksimal 2048 karakter)."]));
    }

    if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (error) {
        return res.status(400).json(createResponse(url, "error", 0, ["Format URL tidak valid secara sintaks."]));
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return res.status(400).json(createResponse(url, "error", 0, ["Akses ke localhost diblokir untuk alasan keamanan."]));
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
        const parts = hostname.split('.').map(Number);
        const isPrivate = (parts[0] === 10) || (parts[0] === 127) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 0);
        if (isPrivate) return res.status(400).json(createResponse(url, "error", 0, ["Akses ke alamat IP privat/lokal diblokir."]));
    }

    let score = 0;
    let reasons = [];
    let sources_checked = [];
    let sources_failed = [];

    // --- SUMBER 1: Google Safe Browsing ---
    const sbKey = process.env.SAFE_BROWSING_KEY;
    if (!sbKey) {
        sources_failed.push("Safe Browsing");
        reasons.push("Safe Browsing: API Key tidak ditemukan di environment.");
    } else {
        try {
            const sbEndpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${sbKey}`;
            const body = {
                client: { clientId: "linksafe", clientVersion: "1.0.0" },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [{ url: url }]
                }
            };

            const response = await fetchWithTimeout(sbEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                timeout: 5000
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            sources_checked.push("Safe Browsing");

            if (data.matches && data.matches.length > 0) {
                score += 60;
                reasons.push("Terdeteksi oleh Google Safe Browsing");
            } else {
                reasons.push("Safe Browsing: URL bersih.");
            }
        } catch (error) {
            sources_failed.push("Safe Browsing");
            reasons.push(`Safe Browsing gagal: ${error.message}.`);
        }
    }

    // --- SUMBER 2: VirusTotal ---
    const vtKey = process.env.VT_KEY;
    if (!vtKey) {
        sources_failed.push("VirusTotal");
        reasons.push("VirusTotal: API Key tidak ditemukan di environment.");
    } else {
        try {
            const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
            const vtEndpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;

            const response = await fetchWithTimeout(vtEndpoint, {
                method: 'GET',
                headers: { 'x-apikey': vtKey },
                timeout: 5000
            });

            if (response.status === 429) throw new Error("Limit harian VirusTotal tercapai (429).");
            if (response.status === 404) {
                sources_checked.push("VirusTotal");
                reasons.push("VirusTotal: URL belum ada di database, dianggap 0 engine.");
            } else {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                sources_checked.push("VirusTotal");

                const stats = data.data.attributes.last_analysis_stats;
                const maliciousCount = stats.malicious || 0;
                const totalEngines = Object.values(stats).reduce((a, b) => a + b, 0);

                if (maliciousCount >= 4) {
                    score += 50;
                    reasons.push(`${maliciousCount} dari ${totalEngines} engine VirusTotal menandai berbahaya`);
                } else if (maliciousCount >= 1) {
                    score += 20;
                    reasons.push(`${maliciousCount} dari ${totalEngines} engine VirusTotal menandai mencurigakan`);
                } else {
                    reasons.push("VirusTotal: 0 engine menandai berbahaya.");
                }
            }
        } catch (error) {
            sources_failed.push("VirusTotal");
            reasons.push(`VirusTotal gagal: ${error.message}.`);
        }
    }

    // --- PENGABUNGAN SKOR & LABEL ---
    score = Math.min(score, 100);
    let riskLevel = "aman";

    if (sources_checked.length === 0) {
        riskLevel = "tidak_diketahui";
        score = 0;
        reasons.push("Tidak ada sumber yang berhasil diperiksa saat ini, coba lagi nanti");
    } else {
        if (sources_failed.length > 0) {
            reasons.push("Sebagian sumber tidak bisa diperiksa, hasil ini belum lengkap");
        }

        if (score <= 19) {
            riskLevel = "aman";
            reasons.push("Tidak ditemukan ancaman dari sumber yang diperiksa, tetap waspada");
        } else if (score <= 59) {
            riskLevel = "waspada";
        } else {
            riskLevel = "bahaya";
        }
    }

    return res.status(200).json(
        createResponse(url, riskLevel, score, reasons, sources_checked, sources_failed)
    );
}

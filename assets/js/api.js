// ==========================================
// LinkSafe - api.js
// LOGIC JARINGAN (fetch ke backend /api/scan)
// Isi fungsi identik dengan app.js lama.
// ==========================================

import { SCAN_TIMEOUT_MS } from './config.js';

// ---------- Panggil backend /api/scan ----------
// Mengembalikan salah satu:
//   { kind: 'ok', data }             -> backend membalas normal
//   { kind: 'input_error', reasons } -> backend menolak input (HTTP 400)
//   { kind: 'failed', message }      -> jaringan/server gagal
export async function callBackend(urlInput) {
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

// =========================================================================
// WARNING: FILE INI HANYA UNTUK DEVELOPMENT LOKAL DI TERMUX.
// JANGAN HAPUS FILE INI saat pembersihan.
// File ini tidak akan ter-deploy ke Vercel karena masuk ke .vercelignore.
// =========================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/scan.js'; 
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(async (req, res) => {
    // Setup CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // 1. Handle API Route (/api/scan)
    if (req.url === '/api/scan' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const parsedBody = JSON.parse(body);
                
                // Bikin "res palsu" (mock) buat nampung jawaban dari api/scan.js
                const mockRes = {
                    status: (code) => {
                        res.writeHead(code, { 'Content-Type': 'application/json' });
                        return mockRes;
                    },
                    json: (data) => {
                        res.end(JSON.stringify(data));
                    }
                };
                
                // Panggil fungsi backend asli dari api/scan.js
                await handler({ method: req.method, body: parsedBody }, mockRes);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Format JSON salah" }));
            }
        });
        return;
    }

    // Arahkan ke folder UI_UX + assets untuk file statis
    const uiPath = path.join(__dirname, 'UI_UX');
    const assetsPath = path.join(__dirname, 'assets');
    const reqUrl = req.url === '/' ? '/index.html' : req.url;
    
    let filePath;
    if (reqUrl.startsWith('/assets/')) {
        filePath = path.join(__dirname, reqUrl);
        if (!filePath.startsWith(assetsPath)) {
            res.writeHead(403);
            return res.end("Akses dilarang");
        }
    } else {
        filePath = path.join(uiPath, reqUrl);
        if (!filePath.startsWith(uiPath)) {
            res.writeHead(403);
            return res.end("Akses dilarang");
        }
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("File tidak ditemukan");
        } else {
            const ext = path.extname(filePath);
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.mjs': 'text/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            };
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(data);
        }
    });
    


});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n✅ Server lokal nyala di: http://localhost:${PORT}`);
    console.log(`Tekan Ctrl+C buat matiin.\n`);
});

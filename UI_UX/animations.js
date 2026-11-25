// ==========================================================
// LinkSafe - animations.js (v9 - GRID PADAT SEPERTI TETRIS/PIXEL)
// Referensi: screenshot "Hacker Login Form" - grid kotak kecil rapat
// Perubahan radikal dari v8:
//  - Cell size: 40px -> 28px (kubus lebih kecil)
//  - Grid lebih rapat: 1.30x -> 1.50x coverage
//  - MAXZ: 1400 -> 280 (tinggi moderat, bukan gedung)
//  - HALF: 0.22 -> 0.47 (kubus hampir memenuhi sel, padat)
//  - PIT: 0.40 -> 0.18 (kamera lebih datar, seperti grid 2.5D)
// Hasil: grid kotak-kotak kecil yang PADAT, RAPAT, dan BERGELOMBANG
// ==========================================================
(function () {
    'use strict';

    var canvas = document.getElementById('cube-canvas');
    var ctx = canvas ? canvas.getContext('2d') : null;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var W = 0, H = 0, dpr = 1;
    var cell = 28, cols = 0, rows = 0;
    var cubes = [];
    var rafId = null, running = false;
    var theme = 'dark';

    try { theme = localStorage.getItem('linksafe-theme') || 'dark'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', theme);

    // === PARAMETER GRID PADAT ===
    var D = 1000, F = 1000;
    var YAW = 0.16, PIT = 0.18;  // DITURUNKAN: 0.40 -> 0.18 (kamera lebih datar)
    var cyaw = Math.cos(YAW), syaw = Math.sin(YAW);
    var cpit = Math.cos(PIT), spit = Math.sin(PIT);

    var MAXZ = 280;     // DITURUNKAN DRASTIS: 1400 -> 280 (tinggi moderat)
    var HALF = 0.47;    // DINAIIKKAN: 0.22 -> 0.47 (kubus padat, hampir penuh sel)
    var BASE = 0.485;
    var NEAR_PLANE = 50;

    var SPD_DIAGONAL = 0.80;
    var SPD_RING = 0.60;

    // === PALET SOLID (cyan-navy terminal) ===
    var CANVAS_D = [6, 16, 31];
    var VALLEY_D = [8, 18, 34];
    var RAMP_D = [[6, 30, 44], [0, 120, 150], [0, 229, 255]];
    var CREST_D = [200, 250, 255];
    var TOPMIX_D = [180, 248, 255];
    var DARK_D = [2, 8, 18];

    var CANVAS_L = [234, 243, 250];
    var VALLEY_L = [205, 226, 240];
    var RAMP_L = [[120, 165, 200], [14, 165, 233], [2, 132, 199]];
    var CREST_L = [8, 60, 95];
    var TOPMIX_L = [255, 255, 255];
    var DARK_L = [15, 23, 42];

    var LUT = [];
    var FOG_BANDS = 8, WAVE_STEPS = 64;

    function mix(a, b, t) {
        if (t < 0) t = 0; if (t > 1) t = 1;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    function css(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

    function rampColor(v) {
        var R = theme === 'light' ? RAMP_L : RAMP_D;
        return v < 0.5 ? mix(R[0], R[1], v * 2) : mix(R[1], R[2], (v - 0.5) * 2);
    }

    function buildLUT() {
        var light = theme === 'light';
        var CANVAS = light ? CANVAS_L : CANVAS_D;
        var VALLEY = light ? VALLEY_L : VALLEY_D;
        var CREST = light ? CREST_L : CREST_D;
        var TOPMIX = light ? TOPMIX_L : TOPMIX_D;
        var DARK = light ? DARK_L : DARK_D;
        LUT = [];
        for (var b = 0; b < FOG_BANDS; b++) {
            var fog = 0.22 + (b / (FOG_BANDS - 1)) * 0.78;
            var row = [];
            for (var k = 0; k < WAVE_STEPS; k++) {
                var v = k / (WAVE_STEPS - 1);
                var face = mix(CANVAS, rampColor(v), fog);
                var top = mix(face, TOPMIX, (light ? 0.30 : 0.30) + v * (light ? 0.30 : 0.45));
                var right = mix(face, DARK, light ? 0.25 : 0.48);
                var valley = mix(CANVAS, mix(VALLEY, RAMP_D[1], 0.04 + v * 0.16), fog * 0.85);
                var crest = mix(CANVAS, CREST, fog * smooth(0.45, 0.85, v));
                row.push({
                    face: css(face), top: css(top), right: css(right),
                    valley: css(valley), crest: css(crest), glowOn: v > 0.45
                });
            }
            LUT.push(row);
        }
    }

    function project(x, y, z, out) {
        var x1 = x * cyaw + z * syaw;
        var z1 = -x * syaw + z * cyaw;
        var y1 = y * cpit - z1 * spit;
        var z2 = y * spit + z1 * cpit;
        var depth = D - z2;
        if (depth < NEAR_PLANE) depth = NEAR_PLANE;
        var f = F / depth;
        out[0] = W * 0.5 + x1 * f;
        out[1] = H * 0.5 + y1 * f;
        out[2] = depth;
        return out;
    }

    function buildGrid() {
        // GRID LEBIH RAPAT: coverage 1.50x (dari 1.30x)
        cell = Math.sqrt((W * H) / 900);  // cell lebih kecil
        cell = clamp(cell, 20, 35);       // range 20-35px (padat!)
        cols = Math.ceil((W * 1.50) / cell);
        rows = Math.ceil((H * 1.50) / cell);
        cubes = [];
        var half = cell * HALF, base = cell * BASE;
        for (var gy = 0; gy < rows; gy++) {
            for (var gx = 0; gx < cols; gx++) {
                var ix = gx - (cols - 1) / 2;
                var iy = gy - (rows - 1) / 2;
                var x = ix * cell, y = iy * cell;
                var c = {
                    x: x, y: y, gx: ix, gy: iy,
                    dist: Math.sqrt(ix * ix + iy * iy),
                    p0: [0, 0, 0],
                    b: [[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
                    t: [[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
                    band: 0
                };
                project(x, y, 0, c.p0);
                project(x - half, y - half, 0, c.b[0]);
                project(x + half, y - half, 0, c.b[1]);
                project(x + half, y + half, 0, c.b[2]);
                project(x - half, y + half, 0, c.b[3]);
                project(x - base, y - base, 0, c.t[0]);
                project(x + base, y - base, 0, c.t[1]);
                project(x + base, y + base, 0, c.t[2]);
                project(x - base, y + base, 0, c.t[3]);
                var fog = clamp(1.25 - c.p0[2] / D, 0.22, 1);
                c.band = Math.round(((fog - 0.22) / 0.78) * (FOG_BANDS - 1));
                cubes.push(c);
            }
        }
    }

    function resize() {
        if (!canvas) return;
        dpr = Math.min(window.devicePixelRatio || 1, W < 768 ? 1.25 : 1.5);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildGrid();
        if (reduced) drawFrame(2.4);
    }

    function field(c, t) {
        var a = Math.sin(c.gx * 0.30 + c.gy * 0.22 - t * SPD_DIAGONAL);
        var b = Math.sin(c.dist * 0.40 - t * SPD_RING);
        var f = (a * 0.60 + b * 0.40 + 1) * 0.5;
        return Math.pow(f, 1.0);
    }

    var fC = [0,0,0], fTL = [0,0,0], fTR = [0,0,0], fBR = [0,0,0], fBL = [0,0,0];

    function quad(a, b, c, d) {
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(d[0], d[1]);
        ctx.closePath();
        ctx.fill();
    }

    function drawFrame(t) {
        if (!ctx) return;
        ctx.fillStyle = css(theme === 'light' ? CANVAS_L : CANVAS_D);
        ctx.fillRect(0, 0, W, H);

        var half = cell * HALF;
        for (var i = 0; i < cubes.length; i++) {
            var c = cubes[i];
            var v = field(c, t);
            var e = MAXZ * v;

            project(c.x, c.y, e, fC);
            var ox = c.p0[0] - fC[0], oy = c.p0[1] - fC[1];
            project(c.x - half, c.y - half, e, fTL); fTL[0] += ox; fTL[1] += oy;
            project(c.x + half, c.y - half, e, fTR); fTR[0] += ox; fTR[1] += oy;
            project(c.x + half, c.y + half, e, fBR); fBR[0] += ox; fBR[1] += oy;
            project(c.x - half, c.y + half, e, fBL); fBL[0] += ox; fBL[1] += oy;

            var idx = (v * (WAVE_STEPS - 1)) | 0;
            var col = LUT[c.band][idx];

            ctx.fillStyle = col.valley;
            quad(c.t[0], c.t[1], c.t[2], c.t[3]);

            ctx.fillStyle = col.right;
            quad(fTR, c.b[1], c.b[2], fBR);
            ctx.fillStyle = col.top;
            quad(fTL, fTR, c.b[1], c.b[0]);

            ctx.fillStyle = col.face;
            quad(fTL, fTR, fBR, fBL);

            if (col.glowOn) {
                ctx.strokeStyle = col.crest;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(fTL[0], fTL[1]);
                ctx.lineTo(fTR[0], fTR[1]);
                ctx.lineTo(fBR[0], fBR[1]);
                ctx.lineTo(fBL[0], fBL[1]);
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    function loop(now) {
        drawFrame(now / 1000);
        rafId = window.requestAnimationFrame(loop);
    }
    function start() {
        if (running || reduced || !ctx) return;
        running = true;
        rafId = window.requestAnimationFrame(loop);
    }
    function stop() {
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = null;
    }

    if (ctx) {
        buildLUT();
        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', resize);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stop(); else start();
        });
        if (reduced) drawFrame(2.4); else start();
    }

    var toggle = document.getElementById('theme-toggle');
    function syncToggle() {
        if (toggle) toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
    syncToggle();
    if (toggle) {
        toggle.addEventListener('click', function () {
            theme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            try { localStorage.setItem('linksafe-theme', theme); } catch (e) {}
            syncToggle();
            buildLUT();
            if (reduced) drawFrame(2.4);
        });
    }

    var input = document.getElementById('url-input');
    var btn = document.getElementById('check-btn');
    if (input && btn) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); btn.click(); }
        });
    }
})();

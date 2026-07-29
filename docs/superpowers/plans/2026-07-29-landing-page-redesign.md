# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic-blue 3-card gateway page at root `index.html` with an audience-split layout (Staff BTAM vs Peserta & Publik) in the cyan-teal palette already used across the rest of the app, and add the missing "Portal Peserta" destination card.

**Architecture:** Single static HTML file with `<style>` inline (same pattern as the current file — no build step, no external CSS/JS files). Full-viewport flex layout: topbar spanning full width, then a two-column flex body (staff column fixed at 30% width, public column flexing to fill the rest), collapsing to a single vertical column below a mobile breakpoint.

**Tech Stack:** Plain HTML + CSS (flexbox, CSS custom media query breakpoint). No Tailwind, no JS framework — this file is served standalone from the repo root, unrelated to the `admin/` Tailwind-CDN build.

## Global Constraints

- Exact hex/rgba values (copied verbatim from the spec — do not substitute similar-looking shades):
  - Staff side gradient: `linear-gradient(160deg, #0d1416 0%, #0b0f10 100%)`
  - Public side gradient: `linear-gradient(160deg, #ecfdf9 0%, #f0fdfa 100%)`
  - Topbar background: `#0b0f10`, border-bottom `#1e3a3f`
  - Staff label color: `#5eead4`
  - Public label color: `#0d9488`
  - Staff card: `background: rgba(45,212,191,.08)`, `border: 1px solid rgba(45,212,191,.25)`
  - Public card: `background: rgba(255,255,255,.75)`, `border: 1px solid rgba(45,212,191,.25)`, `box-shadow: 0 4px 14px rgba(13,148,136,.08)`
  - Staff button: `background: #0d9488`, `color: #f0fdfa`
  - Public button: `background: linear-gradient(135deg, #0d9488, #14b8a6)`, `color: #f0fdfa`
  - Button shape: `border-radius: 999px` (pill)
  - Card shape: `border-radius: 10px`–`12px`, with `backdrop-filter: blur(6px)` (glassmorphism)
- No indigo/purple hues anywhere — cyan-teal only, matching the rest of the redesigned app.
- Staff side: exactly 1 large card ("Admin Panel"), filling the full height of its column.
- Public side: exactly 3 stacked rows (not side-by-side), in this order: Pendaftar, Ujian, Portal Peserta.
- Mobile: public's 3 rows render before the staff card in DOM/visual order (public content is primary for first-time visitors).
- 4 links must point to the existing 4 apps, unchanged targets: `admin/`, `exam/`, `pendaftar/`, `peserta/`.
- Brand elements (logo mark + "Balai Teknik Air Minum" + "SI-SABAT" badge) must appear in the topbar — not omitted, not decorative-only.
- No new external dependencies (no font CDN, no icon library) — inline SVG or CSS shapes only, consistent with the current file's inline SVG icon usage.

---

### Task 1: Rebuild root `index.html` with the audience-split layout

**Files:**
- Modify: `index.html` (full rewrite — the current file is small enough that a full replacement is clearer than incremental diffs)

**Interfaces:**
- Consumes: nothing — this is a standalone static page with no imports.
- Produces: nothing consumed by other tasks — this is the only task in this plan. The 4 `<a href>` targets (`admin/`, `exam/`, `pendaftar/`, `peserta/`) must remain valid relative paths into the existing sibling directories (verify these directories exist in Step 1 before writing links).

- [ ] **Step 1: Verify the 4 target directories exist**

```bash
ls admin/index.html exam/index.html pendaftar/index.html peserta/index.html
```

Expected: all 4 paths print (no "No such file or directory"). These are the exact relative link targets Step 3 will use.

- [ ] **Step 2: Read the current file for reference**

Read `index.html` in full (it is ~167 lines) so you know exactly what you are replacing — do not skip this even though Step 3 gives you the full replacement content, because the design hook and later reviewers will compare against the original file's structure (doctype, lang attribute, viewport meta) which must be preserved.

- [ ] **Step 3: Replace the full file content**

Write the following complete content to `index.html`, replacing everything currently in the file:

```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SI-SABAT</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
        }

        /* ── Topbar ───────────────────────────────── */
        .topbar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 28px;
            background: #0b0f10;
            border-bottom: 1px solid #1e3a3f;
        }

        .topbar .logo {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #0d9488;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .topbar .logo svg { color: #f0fdfa; }

        .topbar .brand-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: #f0fdfa;
            line-height: 1.3;
        }

        .topbar .brand-sub {
            font-size: 0.7rem;
            color: #5eead4;
            opacity: 0.85;
        }

        /* ── Body split ───────────────────────────── */
        .split-body {
            display: flex;
            min-height: calc(100vh - 62px);
        }

        .side {
            padding: 40px 32px;
        }

        .side-label {
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 18px;
            opacity: 0.85;
        }

        /* Staff side — narrow, dark, single large card */
        .side-staff {
            flex: 0 0 30%;
            background: linear-gradient(160deg, #0d1416 0%, #0b0f10 100%);
            color: #fff;
            display: flex;
            flex-direction: column;
        }

        .side-staff .side-label { color: #5eead4; }

        .staff-card {
            flex: 1;
            background: rgba(45, 212, 191, 0.08);
            border: 1px solid rgba(45, 212, 191, 0.25);
            border-radius: 12px;
            backdrop-filter: blur(6px);
            padding: 28px 24px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .staff-card h2 {
            font-size: 1.15rem;
            font-weight: 700;
            color: #fff;
            margin-bottom: 10px;
        }

        .staff-card p {
            font-size: 0.85rem;
            color: #cbd5e1;
            line-height: 1.5;
            margin-bottom: 20px;
        }

        .staff-card .btn {
            align-self: flex-start;
            padding: 9px 20px;
            background: #0d9488;
            color: #f0fdfa;
            text-decoration: none;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 600;
            transition: background 0.15s;
        }

        .staff-card .btn:hover { background: #14b8a6; }

        /* Public side — wide, light, 3 stacked rows */
        .side-public {
            flex: 1;
            background: linear-gradient(160deg, #ecfdf9 0%, #f0fdfa 100%);
        }

        .side-public .side-label { color: #0d9488; }

        .public-card {
            background: rgba(255, 255, 255, 0.75);
            border: 1px solid rgba(45, 212, 191, 0.25);
            border-radius: 12px;
            backdrop-filter: blur(6px);
            box-shadow: 0 4px 14px rgba(13, 148, 136, 0.08);
            padding: 18px 22px;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .public-card h2 {
            font-size: 1rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
        }

        .public-card p {
            font-size: 0.8rem;
            color: #64748b;
            line-height: 1.4;
        }

        .public-card .btn {
            flex-shrink: 0;
            padding: 9px 20px;
            background: linear-gradient(135deg, #0d9488, #14b8a6);
            color: #f0fdfa;
            text-decoration: none;
            border-radius: 999px;
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
            transition: opacity 0.15s;
        }

        .public-card .btn:hover { opacity: 0.85; }

        .footer {
            padding: 20px 28px;
            text-align: center;
            font-size: 0.72rem;
            color: #94a3b8;
            background: #f0fdfa;
        }

        /* ── Mobile: stack vertically, public content first ── */
        @media (max-width: 720px) {
            .split-body {
                flex-direction: column-reverse;
                min-height: auto;
            }

            .side { padding: 28px 20px; }

            .side-staff { flex: none; }

            .staff-card { padding: 22px 20px; }

            .public-card {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }

            .public-card .btn { align-self: flex-start; }
        }
    </style>
</head>
<body>

    <div class="topbar">
        <div class="logo">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
        </div>
        <div>
            <div class="brand-name">Balai Teknik Air Minum</div>
            <div class="brand-sub">SI-SABAT · Kementerian PU / Ditjen Cipta Karya</div>
        </div>
    </div>

    <div class="split-body">
        <div class="side side-staff">
            <div class="side-label">Staff BTAM</div>
            <div class="staff-card">
                <h2>Admin Panel</h2>
                <p>Kelola Bimtek, peserta, pengajar, bank soal, penilaian, dan laporan secara menyeluruh.</p>
                <a href="admin/" class="btn">Login →</a>
            </div>
        </div>

        <div class="side side-public">
            <div class="side-label">Peserta &amp; Publik</div>

            <div class="public-card">
                <div>
                    <h2>Pendaftar</h2>
                    <p>Daftar Bimtek Air Minum</p>
                </div>
                <a href="pendaftar/" class="btn">Daftar Sekarang →</a>
            </div>

            <div class="public-card">
                <div>
                    <h2>Ujian</h2>
                    <p>Akses pre-test dan post-test peserta</p>
                </div>
                <a href="exam/" class="btn">Buka Ujian →</a>
            </div>

            <div class="public-card">
                <div>
                    <h2>Portal Peserta</h2>
                    <p>Cek sertifikat dan isi evaluasi pengajar</p>
                </div>
                <a href="peserta/" class="btn">Masuk →</a>
            </div>
        </div>
    </div>

    <p class="footer">Balai Teknik Air Minum &mdash; Direktorat Jenderal Cipta Karya</p>

</body>
</html>
```

- [ ] **Step 4: Verify the file is valid HTML and links resolve**

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const hrefs=[...html.matchAll(/href=\"([^\"]+)\"/g)].map(m=>m[1]); console.log(hrefs);"
```

Expected output: `[ 'admin/', 'pendaftar/', 'exam/', 'peserta/' ]` — exactly these 4 relative paths, no others, no typos.

- [ ] **Step 5: Serve locally and visually verify in a browser**

```bash
npx --yes http-server -p 8790 -c-1 .
```

Open `http://127.0.0.1:8790/index.html` in a fresh browser tab (not a reused tab — this repo's ES-module-caching history means reused tabs can show stale content, though this static file has no JS modules so it is lower-risk here; still, prefer a new tab for a clean check). Verify:
- Topbar shows logo + "Balai Teknik Air Minum" + "SI-SABAT" badge text on a dark background.
- Left column (~30% width): 1 large dark card "Admin Panel" with a "Login →" button, filling the column's full height.
- Right column (~70% width): 3 stacked cards in order Pendaftar → Ujian → Portal Peserta, each with title+description on the left and a pill button on the right.
- Resize the browser window down to ~375px wide (or use devtools device toolbar) — confirm the layout stacks vertically with the 3 public cards appearing above the staff card.
- Click each of the 4 buttons and confirm they navigate to `/admin/`, `/pendaftar/`, `/exam/`, `/peserta/` respectively (404 is expected only if that app itself isn't otherwise reachable in your local server — the point is confirming the href resolves to the right path, not that every downstream app fully loads).
- Open the browser console and confirm no errors are logged.

Stop the server afterward (`Ctrl+C` or kill the background process).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "style: redesign landing page publik (split staff/publik, cyan-teal, tambah Portal Peserta)"
```

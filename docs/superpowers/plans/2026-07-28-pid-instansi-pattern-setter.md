# P&ID Instansi Module (Pattern-Setter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the two per-page action buttons in the Instansi module ("+ Tambah Instansi" and "Export") from Tailwind default blue/gray to the P&ID cyan-teal palette, establishing the color pattern for page-level buttons that will be replicated to other CRUD modules later.

**Architecture:** Single-file, two-string edit. No new components, no new files, no logic changes — only Tailwind class strings on two existing `<button>` elements in `admin/js/modules/instansi-master/index.js`.

**Tech Stack:** Vanilla JS (no bundler), Tailwind CDN with arbitrary-value classes.

## Global Constraints

- Primary page-action button color: `bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa]` (identical to `openModal()`'s `primary` button style — see `admin/js/components/modal.js`).
- Secondary/neutral button border+hover: `border-[#1e3a3f] hover:bg-[#12181c]` (matches the P&ID border color used across shell/table/modal). Text color (`text-gray-400`) does NOT change.
- The danger button ("Ganti dengan Data Kinerja PDAM") is explicitly OUT OF SCOPE — must remain byte-for-byte unchanged.
- Page title/subtitle, search bar, and badges are explicitly OUT OF SCOPE for this plan — do not touch them.
- No test framework exists in this repo. Verification is `node --check <file>` (syntax) plus manual browser confirmation (not required for this task's implementer — the controller will browser-verify after review, per this project's established pattern).

---

### Task 1: Restyle page-action buttons in Instansi module

**Files:**
- Modify: `admin/js/modules/instansi-master/index.js:29-34`

**Interfaces:**
- Consumes: nothing new — this task only changes Tailwind class attribute strings on existing static HTML template literals inside `renderInstansiList()`.
- Produces: nothing consumed by other tasks — this is the only task in this plan.

**Context — current code at lines 28-35:**

```javascript
        <div class="flex items-center gap-2">
          <button id="btn-import-historis" class="px-3 py-2 rounded-lg text-xs text-red-400 border border-red-800 hover:bg-red-900/20 transition-colors">Ganti dengan Data Kinerja PDAM</button>
          <button id="btn-export" class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors">Export</button>
          <button id="btn-add" class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Tambah Instansi
          </button>
        </div>
```

- [ ] **Step 1: Edit the "Export" button's class string**

In `admin/js/modules/instansi-master/index.js`, find the `id="btn-export"` button (currently line 30). Change its `class` attribute from:

```
class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors"
```

to:

```
class="px-3 py-2 rounded-lg text-xs text-gray-400 border border-[#1e3a3f] hover:bg-[#12181c] transition-colors"
```

Only `border-gray-700` → `border-[#1e3a3f]` and `hover:bg-gray-800` → `hover:bg-[#12181c]` change. `text-gray-400` and all other classes stay exactly as they are. The `id="btn-import-historis"` button directly above it (danger, red) must remain completely untouched — do not edit that line.

- [ ] **Step 2: Edit the "Tambah Instansi" button's class string**

Find the `id="btn-add"` button (currently line 31). Change its `class` attribute from:

```
class="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
```

to:

```
class="px-3 py-2 rounded-lg text-xs bg-[#0d9488] hover:bg-[#14b8a6] text-[#f0fdfa] transition-colors flex items-center gap-2"
```

Only the three color classes change (`bg-blue-600`→`bg-[#0d9488]`, `hover:bg-blue-500`→`hover:bg-[#14b8a6]`, `text-white`→`text-[#f0fdfa]`). The `<svg>` icon inside the button uses `stroke="currentColor"`, so it automatically follows the new text color — do not add any class to the `<svg>` element itself.

- [ ] **Step 3: Verify no other occurrences of the old colors remain in this file**

Run this from the repo root to confirm the two edits are the only color changes needed and nothing else in the file still references the old blue/gray:

```bash
grep -n "bg-blue-600\|hover:bg-blue-500\|border-gray-700\|hover:bg-gray-800" admin/js/modules/instansi-master/index.js
```

Expected: no output (empty). If any line still matches, it means Step 1 or Step 2 missed an occurrence — go back and fix it.

- [ ] **Step 4: Syntax-check the file**

```bash
node --check admin/js/modules/instansi-master/index.js
```

Expected: no output, exit code 0.

- [ ] **Step 5: Confirm the danger button is unchanged**

```bash
git diff admin/js/modules/instansi-master/index.js | grep -A2 -B2 "btn-import-historis"
```

Expected: no output — `git diff` should show no hunk touching the `btn-import-historis` line, proving the danger button's class string is byte-for-byte identical to before.

- [ ] **Step 6: Commit**

```bash
git add admin/js/modules/instansi-master/index.js
git commit -m "style: warna P&ID untuk tombol aksi halaman modul Instansi (pattern-setter)"
```

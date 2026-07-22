// admin/js/modules/bimtek/evaluasi-ui.js
// Kartu ringkasan skor + komentar evaluasi (rata-rata per pertanyaan + bar).
// Dipakai tab Evaluasi (detail bimtek) dan Laporan Evaluasi (lintas bimtek).

export function renderEvaluasiGroupCard(title, group, pertanyaan) {
  if (!group) return '';
  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-white">${_esc(title)}</h3>
        ${group.avgOverall != null ? `
          <span class="text-xs px-2 py-1 rounded-lg bg-amber-900/30 text-amber-400 font-semibold">
            ★ ${group.avgOverall.toFixed(1)} / 5
          </span>` : ''}
      </div>
      <div class="space-y-2.5 mb-4">
        ${pertanyaan.map(q => {
          const v = group.avgPerKey[q.key];
          const pct = v != null ? (v / 5) * 100 : 0;
          return `
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-gray-400">${_esc(q.label)}</span>
                <span class="text-gray-300 font-mono">${v != null ? v.toFixed(1) : '—'}</span>
              </div>
              <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-amber-500 rounded-full" style="width:${pct}%"></div>
              </div>
            </div>`;
        }).join('')}
      </div>
      ${group.komentar.length ? `
        <div class="border-t border-gray-800 pt-3">
          <p class="text-xs text-gray-500 mb-2">Komentar (${group.komentar.length})</p>
          <div class="space-y-1.5 max-h-48 overflow-y-auto">
            ${group.komentar.map(k => `<p class="text-xs text-gray-400 bg-gray-800/50 rounded-lg px-2.5 py-1.5">"${_esc(k)}"</p>`).join('')}
          </div>
        </div>` : ''}
    </div>`;
}

function _esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

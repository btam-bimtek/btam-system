// admin/js/components/data-table.js
// Reusable data table dengan search, pagination, loading state.

/**
 * Render data table ke dalam container element.
 *
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {object[]}  opts.columns   - [{key, label, render?, sortable?, width?}]
 * @param {object[]}  opts.data      - array of row objects
 * @param {number}    [opts.total]   - total rows (untuk pagination info)
 * @param {number}    [opts.page]    - current page (1-based)
 * @param {number}    [opts.perPage] - rows per page
 * @param {boolean}   [opts.loading]
 * @param {string}    [opts.emptyMessage]
 * @param {function}  [opts.onPageChange]  - (newPage) => void
 * @param {function}  [opts.onRowClick]    - (row) => void
 * @param {object[]}  [opts.rowActions]    - [{label, icon?, onClick, show?}] — tombol per baris
 */
export function renderDataTable(container, opts) {
  const {
    columns = [],
    data = [],
    total = data.length,
    page = 1,
    perPage = 25,
    loading = false,
    emptyMessage = 'Tidak ada data.',
    onPageChange,
    onRowClick,
    rowActions = []
  } = opts;

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  container.innerHTML = `
    <div class="rounded-xl border border-gray-800 overflow-hidden">
      <!-- Table wrapper -->
      <div class="overflow-x-auto">
        <table class="btam-table w-full">
          <thead>
            <tr>
              ${columns.map(c => `
                <th style="${c.width ? `width:${c.width}` : ''}" class="text-xs">
                  ${c.label}
                </th>`).join('')}
              ${rowActions.length ? '<th class="text-xs w-24">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody id="dt-body">
            ${loading ? _loadingRows(columns.length + (rowActions.length ? 1 : 0)) : ''}
          </tbody>
        </table>
      </div>

      <!-- Footer pagination -->
      <div class="px-4 py-3 border-t border-gray-800 flex items-center justify-between
                  bg-gray-900/50 text-xs text-gray-500">
        <span>${total === 0 ? '0 data' : `${from}–${to} dari ${total} data`}</span>
        <div class="flex items-center gap-1" id="dt-pagination"></div>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#dt-body');
  const paginationEl = container.querySelector('#dt-pagination');

  if (!loading) {
    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${columns.length + (rowActions.length ? 1 : 0)}"
              class="text-center text-gray-500 py-12 text-sm">
            ${emptyMessage}
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = data.map((row, i) => `
        <tr class="${onRowClick ? 'cursor-pointer hover:bg-gray-800/50' : ''}" data-row="${i}">
          ${columns.map(c => `
            <td>${c.render ? c.render(row[c.key], row) : _escHtml(row[c.key] ?? '—')}</td>
          `).join('')}
          ${rowActions.length ? `
            <td>
              <div class="flex items-center gap-1">
                ${rowActions
                  .filter(a => !a.show || a.show(row))
                  .map(a => `
                    <button data-action="${a.label}" data-row="${i}"
                      class="px-2 py-1 rounded text-xs text-gray-400 hover:text-white
                             hover:bg-gray-700 transition-colors whitespace-nowrap">
                      ${a.label}
                    </button>`).join('')}
              </div>
            </td>` : ''}
        </tr>
      `).join('');

      // Bind row click
      if (onRowClick) {
        tbody.querySelectorAll('tr[data-row]').forEach(tr => {
          tr.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // jangan trigger kalau klik tombol aksi
            onRowClick(data[+tr.dataset.row]);
          });
        });
      }

      // Bind row actions
      tbody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = rowActions.find(a => a.label === btn.dataset.action);
          action?.onClick(data[+btn.dataset.row]);
        });
      });
    }
  }

  // Pagination buttons
  if (onPageChange && totalPages > 1) {
    _renderPagination(paginationEl, page, totalPages, onPageChange);
  }
}

function _loadingRows(colCount) {
  return Array(5).fill(0).map(() => `
    <tr>
      ${Array(colCount).fill(0).map(() => `
        <td><div class="h-4 bg-gray-800 rounded animate-pulse"></div></td>
      `).join('')}
    </tr>
  `).join('');
}

function _renderPagination(el, current, total, onChange) {
  const pages = _getPageNumbers(current, total);
  el.innerHTML = pages.map(p => {
    if (p === '...') return `<span class="px-1 text-gray-600">…</span>`;
    return `
      <button data-page="${p}"
        class="w-7 h-7 rounded flex items-center justify-center text-xs transition-colors
               ${p === current
                 ? 'bg-blue-600 text-white'
                 : 'text-gray-400 hover:bg-gray-700 hover:text-white'}">
        ${p}
      </button>`;
  }).join('');

  // Prev / Next
  const nav = `
    <button data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}
      class="w-7 h-7 rounded flex items-center justify-center text-gray-400
             hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      ‹
    </button>
    ${el.innerHTML}
    <button data-page="${current + 1}" ${current >= total ? 'disabled' : ''}
      class="w-7 h-7 rounded flex items-center justify-center text-gray-400
             hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      ›
    </button>`;
  el.innerHTML = nav;

  el.querySelectorAll('button[data-page]:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => onChange(+btn.dataset.page));
  });
}

function _getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total-4, total-3, total-2, total-1, total];
  return [1, '...', current-1, current, current+1, '...', total];
}

function _escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

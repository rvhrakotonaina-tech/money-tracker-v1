const STORAGE_KEY = "money-tracker:v1";
const SETTINGS_KEY = "money-tracker:settings";
let transactions = [];
let currentPage = 1;
const pageSize = 10;
let monthlyChart;
let categoryChart;
let selectedCurrency = "USD";
let selectedTheme = "light";

// i18n helper
function tt(key, params) {
  try {
    if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key, params);
  } catch {}
  return key;
}

const el = (id) => document.getElementById(id);
const incomeTotalEl = el("incomeTotal");
const expenseTotalEl = el("expenseTotal");
const balanceTotalEl = el("balanceTotal");
const txForm = el("txForm");
const txType = el("txType");
const txAmount = el("txAmount");
const txCategory = el("txCategory");
const txNote = el("txNote");
const txDate = el("txDate");
const txTableBody = el("txTableBody");
const txCount = el("txCount");
const prevPage = el("prevPage");
const nextPage = el("nextPage");
const filterType = el("filterType");
const filterCategory = el("filterCategory");
const filterFrom = el("filterFrom");
const filterTo = el("filterTo");
const filterSearch = el("filterSearch");
const categoryList = el("categoryList");
const exportJsonBtn = el("exportJsonBtn");
const importJsonInput = el("importJsonInput");
const seedBtn = el("seedBtn");
const resetBtn = el("resetBtn");
const currencyInput = el("currencyInput");
const themeToggle = el("themeToggle");

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

function currency(n) {
  const v = Number(n || 0);
  try {
    return v.toLocaleString(undefined, { style: "currency", currency: selectedCurrency || "USD" });
  } catch {
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ currency: selectedCurrency, theme: selectedTheme }));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    selectedCurrency = (s.currency || "USD").toUpperCase();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    selectedTheme = s.theme ? (s.theme === 'dark' ? 'dark' : 'light') : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', selectedTheme === 'dark');
  } catch {
    selectedCurrency = "USD";
    selectedTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
}

function normalizeDateInput(value) {
  if (value) return value;
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function computeTotals(list) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

function updateSummary() {
  const filtered = getFiltered();
  const totals = computeTotals(filtered);
  incomeTotalEl.textContent = currency(totals.income);
  expenseTotalEl.textContent = currency(totals.expense);
  balanceTotalEl.textContent = currency(totals.balance);
}

function getFilters() {
  return {
    type: filterType.value,
    category: (filterCategory.value || "").trim().toLowerCase(),
    from: filterFrom.value ? new Date(filterFrom.value) : null,
    to: filterTo.value ? new Date(filterTo.value) : null,
    search: (filterSearch.value || "").trim().toLowerCase(),
  };
}

function getFiltered() {
  const f = getFilters();
  return transactions.filter((t) => {
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.category && t.category.toLowerCase() !== f.category) return false;
    const d = new Date(t.date);
    if (f.from && d < f.from) return false;
    if (f.to && d > new Date(f.to.getTime() + 86400000 - 1)) return false;
    if (f.search && !(t.note || "").toLowerCase().includes(f.search)) return false;
    return true;
  });
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function paginate(list) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * pageSize;
  const items = list.slice(start, start + pageSize);
  return { items, total, pages };
}

function renderCategoriesDatalist() {
  const cats = Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))).sort();
  categoryList.innerHTML = cats.map((c) => `<option value="${c}"></option>`).join("");
}

function renderTable() {
  const filtered = sortByDateDesc(getFiltered());
  const { items, total, pages } = paginate(filtered);
  txTableBody.innerHTML = items
    .map((t) => {
      const signClass = t.type === "income" ? "text-emerald-600" : "text-rose-600";
      const typeLabel = t.type === "income" ? tt("income") : tt("expenses");
      const amount = (t.type === "expense" ? -t.amount : t.amount);
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2">${t.date}</td>
        <td class="px-3 py-2"><span class="px-2 py-1 text-xs rounded-full ${t.type === "income" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"}">${typeLabel}</span></td>
        <td class="px-3 py-2">${t.category || "-"}</td>
        <td class="px-3 py-2 text-slate-600">${t.note || ""}</td>
        <td class="px-3 py-2 text-right font-medium ${signClass}">${currency(amount)}</td>
        <td class="px-3 py-2 text-right">
          <button data-id="${t.id}" class="editTx px-2 py-1 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 shadow-sm dark:bg-slate-600 dark:text-white dark:border-slate-500 dark:hover:bg-slate-500">${tt("edit")}</button>
          <button data-id="${t.id}" class="delTx px-2 py-1 text-xs font-medium border border-slate-200 rounded-lg bg-white ml-1 hover:bg-slate-50 shadow-sm dark:bg-rose-600 dark:text-white dark:border-rose-500 dark:hover:bg-rose-500">${tt("delete")}</button>
        </td>
      </tr>`;
    })
    .join("");
  txCount.textContent = total === 1 ? tt("tx_count_one") : tt("tx_count_other", { count: total });
  prevPage.disabled = currentPage <= 1;
  nextPage.disabled = currentPage >= pages;
}

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlySeries(list) {
  const now = new Date();
  const labels = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  const map = new Map(labels.map((k) => [k, { income: 0, expense: 0 }]));
  for (const t of list) {
    const k = monthKey(t.date);
    if (!map.has(k)) continue;
    if (t.type === "income") map.get(k).income += t.amount;
    else map.get(k).expense += t.amount;
  }
  const income = labels.map((k) => map.get(k).income);
  const expense = labels.map((k) => map.get(k).expense);
  return { labels, income, expense };
}

function buildCategorySeries(list) {
  const m = new Map();
  for (const t of list) {
    if (t.type !== "expense") continue;
    const k = t.category || tt("other");
    m.set(k, (m.get(k) || 0) + t.amount);
  }
  const labels = Array.from(m.keys());
  const values = Array.from(m.values());
  return { labels, values };
}

function renderCharts() {
  const filtered = getFiltered();
  const monthly = buildMonthlySeries(filtered);
  const cat = buildCategorySeries(filtered);

  const monthlyCtx = document.getElementById("monthlyChart");
  const categoryCtx = document.getElementById("categoryChart");

  if (monthlyChart) monthlyChart.destroy();
  if (categoryChart) categoryChart.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? '#334155' : '#eef2f7';

  monthlyChart = new Chart(monthlyCtx, {
    type: "bar",
    data: {
      labels: monthly.labels,
      datasets: [
        {
          label: tt("income"),
          data: monthly.income,
          backgroundColor: "#10b981",
          borderRadius: 6,
        },
        {
          label: tt("expenses"),
          data: monthly.expense,
          backgroundColor: "#ef4444",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: gridColor, display: true }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor } },
      },
      plugins: { legend: { display: true, labels: { color: textColor } } },
    },
  });

  categoryChart = new Chart(categoryCtx, {
    type: "doughnut",
    data: {
      labels: cat.labels,
      datasets: [
        {
          data: cat.values,
          backgroundColor: [
            "#f87171",
            "#fb923c",
            "#fbbf24",
            "#34d399",
            "#60a5fa",
            "#a78bfa",
            "#f472b6",
            "#22d3ee",
            "#93c5fd",
            "#fdba74",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: textColor } } },
    },
  });
}

function refresh() {
  updateSummary();
  renderCategoriesDatalist();
  renderTable();
  renderCharts();
}

function addTransaction(t) {
  transactions.push(t);
  save();
  refresh();
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  save();
  refresh();
}

function editTransaction(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;
  const amountStr = prompt("Amount", String(t.amount));
  if (amountStr === null) return;
  const amount = parseFloat(amountStr);
  if (!(amount >= 0)) return;
  const category = prompt("Category", t.category || "") || "";
  const note = prompt("Note", t.note || "") || "";
  const date = prompt("Date (YYYY-MM-DD)", t.date) || t.date;
  const type = prompt("Type (income/expense)", t.type) || t.type;
  t.amount = amount;
  t.category = category.trim();
  t.note = note.trim();
  t.date = date;
  t.type = type === "income" ? "income" : "expense";
  save();
  refresh();
}

function exportJSON() {
  const dataStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `money-tracker-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) return;
      const cleaned = data
        .map((t) => ({
          id: String(t.id || crypto.randomUUID()),
          type: t.type === "income" ? "income" : "expense",
          amount: Math.abs(Number(t.amount || 0)),
          category: String(t.category || ""),
          note: String(t.note || ""),
          date: (t.date || normalizeDateInput(t.date)).slice(0, 10),
        }))
        .filter((t) => !Number.isNaN(t.amount));
      transactions = cleaned;
      save();
      currentPage = 1;
      refresh();
    } catch {}
  };
  reader.readAsText(file);
}

function seedSample() {
  const catsIn = ["Salary", "Freelance", "Investments"];
  const catsOut = ["Groceries", "Rent", "Transport", "Dining", "Entertainment", "Bills"];
  const now = new Date();
  const items = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - Math.floor(i / 5), 1 + (i % 28));
    if (i % 3 === 0) {
      items.push({
        id: crypto.randomUUID(),
        type: "income",
        amount: Math.round(500 + Math.random() * 2000),
        category: catsIn[Math.floor(Math.random() * catsIn.length)],
        note: "",
        date: d.toISOString().slice(0, 10),
      });
    }
    items.push({
      id: crypto.randomUUID(),
      type: "expense",
      amount: Math.round(10 + Math.random() * 300),
      category: catsOut[Math.floor(Math.random() * catsOut.length)],
      note: "",
      date: d.toISOString().slice(0, 10),
    });
  }
  transactions = items;
  save();
  currentPage = 1;
  refresh();
}

function resetAll() {
  if (!confirm(tt("confirm_clear"))) return;
  transactions = [];
  save();
  currentPage = 1;
  refresh();
}

function initEvents() {
  txForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat(txAmount.value);
    if (!(amount >= 0)) return;
    const t = {
      id: crypto.randomUUID(),
      type: txType.value === "income" ? "income" : "expense",
      amount: Math.abs(amount),
      category: (txCategory.value || "").trim(),
      note: (txNote.value || "").trim(),
      date: normalizeDateInput(txDate.value),
    };
    addTransaction(t);
    txAmount.value = "";
    txNote.value = "";
  });

  txTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (btn.classList.contains("delTx")) deleteTransaction(id);
    if (btn.classList.contains("editTx")) editTransaction(id);
  });

  for (const f of [filterType, filterCategory, filterFrom, filterTo]) {
    f.addEventListener("change", () => {
      currentPage = 1;
      refresh();
    });
  }
  filterSearch.addEventListener("input", () => {
    currentPage = 1;
    refresh();
  });

  prevPage.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });
  nextPage.addEventListener("click", () => {
    currentPage++;
    renderTable();
  });

  exportJsonBtn.addEventListener("click", exportJSON);
  importJsonInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importJSON(file);
    importJsonInput.value = "";
  });
  seedBtn.addEventListener("click", seedSample);
  resetBtn.addEventListener("click", resetAll);

  if (currencyInput) {
    currencyInput.value = selectedCurrency;
    currencyInput.addEventListener("change", () => {
      const prev = selectedCurrency;
      const val = (currencyInput.value || "").trim().toUpperCase();
      if (!val) return;
      try {
        (0).toLocaleString(undefined, { style: "currency", currency: val });
        selectedCurrency = val;
        saveSettings();
        refresh();
      } catch {
        alert(tt("invalid_currency"));
        currencyInput.value = prev;
      }
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      selectedTheme = selectedTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', selectedTheme === 'dark');
      saveSettings();
    });
  }
}

function init() {
  load();
  loadSettings();
  renderCategoriesDatalist();
  initEvents();
  refresh();

  // Re-render on language change
  document.addEventListener('i18n:changed', () => {
    renderTable();
    renderCharts();
    // static texts are updated by i18n.js; summary numbers need no translation
    const filtered = getFiltered();
    const { total } = paginate(sortByDateDesc(filtered));
    txCount.textContent = total === 1 ? tt("tx_count_one") : tt("tx_count_other", { count: total });
  });
}

document.addEventListener("DOMContentLoaded", init);

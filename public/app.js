const state = {
  role: null,
  adminPassword: "",
  employeeCode: "",
  employee: null,
  data: null,
  year: new Date().getFullYear(),
  period: "year"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const monthNames = [
  "Januar",
  "Februar",
  "Maerz",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember"
];
const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

document.addEventListener("DOMContentLoaded", () => {
  $("#yearInput").value = state.year;
  bindEvents();
  restoreSession();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((items) => items.forEach((item) => item.unregister())).catch(() => {});
  }
});

function bindEvents() {
  $("#employeeLogin").addEventListener("submit", employeeLogin);
  $("#adminLogin").addEventListener("submit", adminLogin);
  $("#vacationForm").addEventListener("submit", saveVacation);
  $("#employeeForm").addEventListener("submit", saveEmployee);
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#printButton").addEventListener("click", printPdf);
  $("#logoutButton").addEventListener("click", logout);
  $("#yearInput").addEventListener("change", async (event) => {
    state.year = Number(event.target.value || new Date().getFullYear());
    await refreshData();
  });
  $$(".tab").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
  $$(".period").forEach((button) =>
    button.addEventListener("click", () => {
      state.period = button.dataset.period;
      $$(".period").forEach((item) => item.classList.toggle("active", item === button));
      render();
    })
  );
}

async function loadPublic() {
  const response = await fetch(`/api/public?year=${state.year}`);
  state.data = await response.json();
  render();
}

async function restoreSession() {
  try {
    const response = await fetch(`/api/session?year=${state.year}`);
    if (!response.ok) throw new Error("No session");
    const payload = await response.json();
    state.role = payload.role;
    state.employee = payload.employee || null;
    state.adminPassword = "";
    state.employeeCode = "";
    state.data = payload.data;
    document.body.classList.add("signed-in");
    $("#loginPanel").classList.add("hidden");
    $("#workspace").classList.remove("hidden");
    $("#logoutButton").classList.remove("hidden");
    showTab(payload.role === "admin" ? "plan" : "entries");
    render();
  } catch {
    await loadPublic();
  }
}

async function refreshData() {
  if (state.role === "admin") {
    const response = await api(`/api/session?year=${state.year}`);
    state.data = response.data;
  } else if (state.role === "employee") {
    const response = await api(`/api/session?year=${state.year}`);
    state.employee = response.employee;
    state.data = response.data;
  } else {
    await loadPublic();
    return;
  }
  render();
}

async function employeeLogin(event) {
  event.preventDefault();
  const loginCode = $("#employeeCode").value.trim();
  const response = await api("/api/employee/login", {
    method: "POST",
    body: { loginCode, year: state.year }
  });
  state.role = "employee";
  state.employeeCode = loginCode;
  state.employee = response.employee;
  state.data = response.data;
  document.body.classList.add("signed-in");
  $("#loginPanel").classList.add("hidden");
  $("#workspace").classList.remove("hidden");
  $("#logoutButton").classList.remove("hidden");
  showTab("entries");
  toast(`Willkommen, ${state.employee.name}.`);
  render();
}

async function adminLogin(event) {
  event.preventDefault();
  const password = $("#adminPassword").value;
  const response = await api("/api/admin/login", {
    method: "POST",
    headers: { "x-admin-password": password },
    body: { year: state.year }
  });
  state.role = "admin";
  state.adminPassword = password;
  state.data = response.data;
  document.body.classList.add("signed-in");
  $("#loginPanel").classList.add("hidden");
  $("#workspace").classList.remove("hidden");
  $("#logoutButton").classList.remove("hidden");
  showTab("plan");
  toast("Admin geoeffnet.");
  render();
}

function logout() {
  fetch("/api/logout", { method: "POST" }).catch(() => {});
  state.role = null;
  state.adminPassword = "";
  state.employeeCode = "";
  state.employee = null;
  document.body.classList.remove("signed-in");
  $("#workspace").classList.add("hidden");
  $("#loginPanel").classList.remove("hidden");
  $("#logoutButton").classList.add("hidden");
  $("#roleBadge").textContent = "Nicht angemeldet";
  $("#pageTitle").textContent = "Ferienplan";
  $("#adminPassword").value = "";
  $("#employeeCode").value = "";
  loadPublic();
}

async function saveVacation(event) {
  event.preventDefault();
  const body = {
    employeeId: state.role === "admin" ? $("#vacationEmployee").value : state.employee.id,
    startDate: $("#vacationStart").value,
    endDate: $("#vacationEnd").value,
    note: $("#vacationNote").value,
    year: state.year
  };
  const headers = state.role === "admin" ? { "x-admin-password": state.adminPassword } : { "x-employee-code": state.employeeCode };
  state.data = await api("/api/vacations", { method: "POST", headers, body });
  event.target.reset();
  toast("Ferien eingetragen.");
  render();
}

async function saveEmployee(event) {
  event.preventDefault();
  const body = {
    name: $("#employeeName").value,
    vacationDays: $("#employeeDays").value,
    carryoverDays: $("#employeeCarry").value,
    year: state.year
  };
  state.data = await api("/api/admin/employees", {
    method: "POST",
    headers: { "x-admin-password": state.adminPassword },
    body
  });
  event.target.reset();
  $("#employeeDays").value = 25;
  $("#employeeCarry").value = 0;
  toast("Mitarbeiter hinzugefuegt.");
  render();
}

async function saveSettings(event) {
  event.preventDefault();
  const body = {
    companyName: $("#companyName").value,
    includeHolidayLikeDays: $("#includeHolidayLikeDays").checked,
    newPassword: $("#newPassword").value,
    year: state.year
  };
  state.data = await api("/api/admin/settings", {
    method: "PUT",
    headers: { "x-admin-password": state.adminPassword },
    body
  });
  if (body.newPassword) state.adminPassword = body.newPassword;
  $("#newPassword").value = "";
  toast("Einstellungen gespeichert.");
  render();
}

async function deleteVacation(id) {
  const headers = state.role === "admin" ? { "x-admin-password": state.adminPassword } : { "x-employee-code": state.employeeCode };
  state.data = await api(`/api/vacations/${id}?year=${state.year}`, { method: "DELETE", headers });
  toast("Ferieneintrag entfernt.");
  render();
}

async function updateEmployee(employee) {
  state.data = await api(`/api/admin/employees/${employee.id}`, {
    method: "PUT",
    headers: { "x-admin-password": state.adminPassword },
    body: { ...employee, year: state.year }
  });
  toast("Mitarbeiter gespeichert.");
  render();
}

async function removeEmployee(id) {
  state.data = await api(`/api/admin/employees/${id}?year=${state.year}`, {
    method: "DELETE",
    headers: { "x-admin-password": state.adminPassword }
  });
  toast("Mitarbeiter deaktiviert.");
  render();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    toast(data.error || "Etwas hat nicht geklappt.");
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function showTab(tabName) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  $$(".tab-view").forEach((view) => view.classList.add("hidden"));
  $(`#tab-${tabName}`).classList.remove("hidden");
  const active = $(`.tab[data-tab="${tabName}"]`);
  if (active) $("#pageTitle").textContent = active.dataset.title || active.textContent.trim();
}

function render() {
  if (!state.data) return;
  $("#companyTitle").textContent = state.data.settings.companyName;
  document.title = state.data.settings.companyName;
  $("#roleBadge").textContent = state.role === "admin" ? "Admin" : state.role === "employee" ? state.employee.name : "Nicht angemeldet";
  $$(".admin-only").forEach((item) => item.classList.toggle("hidden", state.role !== "admin"));
  $("#companyName").value = state.data.settings.companyName;
  $("#includeHolidayLikeDays").checked = Boolean(state.data.settings.includeHolidayLikeDays);
  renderAlerts();
  renderDashboard();
  renderEmployeeSelect();
  renderCalendar();
  renderSummary();
  renderVacationList();
  renderEmployees();
  buildPrintView();
}

function renderDashboard() {
  const stats = $("#dashboardStats");
  const todayPanel = $("#todayPanel");
  if (!stats || !todayPanel) return;
  const employees = state.data.employees.filter((employee) => employee.active);
  const summaries = state.role === "employee"
    ? state.data.summary.employees.filter((item) => item.employeeId === state.employee.id)
    : state.data.summary.employees;
  const vacations = state.role === "employee"
    ? state.data.vacations.filter((item) => item.employeeId === state.employee.id)
    : state.data.vacations;
  const today = toIso(new Date());
  const awayToday = vacations.filter((vacation) => vacation.startDate <= today && vacation.endDate >= today);
  const used = summaries.reduce((sum, item) => sum + Number(item.used || 0), 0);
  const remaining = summaries.reduce((sum, item) => sum + Number(item.remainingAnnual || 0), 0);
  const openCarry = summaries.reduce((sum, item) => sum + Number(item.remainingCarry || 0), 0);
  const conflictCount = state.role === "admin" ? (state.data.overlaps || []).length : vacations.filter((vacation) => hasConflict(vacation)).length;

  stats.innerHTML = [
    statCard("Mitarbeitende", state.role === "admin" ? employees.length : state.role === "employee" ? 1 : 0, "aktive Personen"),
    statCard("Ferientage genutzt", used, `${state.year}`),
    statCard("Resttage", remaining, "Jahresferien"),
    statCard("Warnungen", conflictCount, openCarry ? `${openCarry} Uebertrag offen` : "keine Uebertraege")
  ].join("");

  const employeeById = new Map(state.data.employees.map((employee) => [employee.id, employee]));
  const todayLines = awayToday.length
    ? awayToday.map((vacation) => {
        const employee = employeeById.get(vacation.employeeId);
        return `<div class="today-line"><span>${escapeHtml(employee?.name || "Unbekannt")}</span><strong>${formatDate(vacation.endDate)}</strong></div>`;
      }).join("")
    : `<div class="today-line"><span>Heute niemand abwesend</span><strong>${formatDate(today)}</strong></div>`;
  const nextHoliday = state.data.holidays.find((holiday) => holiday.date >= today) || state.data.holidays[0];
  todayPanel.innerHTML = `
    <span class="section-label">Heute</span>
    <h2>${formatDate(today)}</h2>
    <div class="today-list">${todayLines}</div>
    ${nextHoliday ? `<div class="today-line"><span>Naechster Feiertag</span><strong>${formatDate(nextHoliday.date)}</strong></div>` : ""}
  `;
}

function statCard(label, value, detail) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(detail)}</em>
    </article>
  `;
}

function hasConflict(vacation) {
  return (state.data.overlaps || []).some((item) => item.vacationId === vacation.id);
}

function renderAlerts() {
  const alerts = $("#alerts");
  const overlaps = state.data.overlaps || [];
  alerts.innerHTML = "";
  if (state.role !== "admin" || overlaps.length === 0) return;
  const unique = new Map();
  overlaps.forEach((item) => {
    const key = [item.employeeName, item.startDate, item.endDate].join("|");
    if (!unique.has(key)) unique.set(key, item);
  });
  unique.forEach((item) => {
    const names = item.conflicts.map((conflict) => conflict.employeeName).join(", ");
    alerts.insertAdjacentHTML(
      "beforeend",
      `<div class="alert">Ueberschneidung: ${escapeHtml(item.employeeName)} (${formatDate(item.startDate)} - ${formatDate(
        item.endDate
      )}) mit ${escapeHtml(names)}</div>`
    );
  });
}

function renderEmployeeSelect() {
  const select = $("#vacationEmployee");
  select.innerHTML = state.data.employees
    .filter((employee) => employee.active)
    .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
}

function renderCalendar() {
  const container = $("#calendar");
  const months = state.period === "h1" ? range(0, 5) : state.period === "h2" ? range(6, 11) : range(0, 11);
  container.innerHTML = months.map(renderMonth).join("");
}

function renderMonth(monthIndex) {
  const first = new Date(state.year, monthIndex, 1);
  const last = new Date(state.year, monthIndex + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(`<div class="day empty"></div>`);
  for (let day = 1; day <= last.getDate(); day += 1) cells.push(renderDay(new Date(state.year, monthIndex, day)));
  return `
    <article class="month">
      <h3>${monthNames[monthIndex]}</h3>
      <div class="month-grid">
        ${weekdayNames.map((name) => `<div class="weekday">${name}</div>`).join("")}
        ${cells.join("")}
      </div>
    </article>
  `;
}

function renderDay(date) {
  const iso = toIso(date);
  const employeeById = new Map(state.data.employees.map((employee) => [employee.id, employee]));
  const vacations = state.data.vacations.filter((vacation) => vacation.startDate <= iso && vacation.endDate >= iso);
  const holiday = state.data.holidays.find((item) => item.date === iso);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const classes = ["day"];
  if (isWeekend) classes.push("weekend");
  if (holiday?.type === "official") classes.push("holiday");
  if (holiday?.type === "holidayLike") classes.push("holiday-like");
  if (vacations.length > 1) classes.push("conflict");
  const chips = vacations
    .map((vacation) => {
      const employee = employeeById.get(vacation.employeeId);
      return `<span class="chip" style="background:${employee?.color || "#2563eb"}">${escapeHtml(employee?.name || "Unbekannt")}</span>`;
    })
    .join("");
  return `
    <div class="${classes.join(" ")}" title="${holiday ? escapeHtml(holiday.name) : ""}">
      <div class="date-num">${date.getDate()}</div>
      ${holiday ? `<div class="holiday-name">${escapeHtml(holiday.name)}</div>` : ""}
      ${chips}
    </div>
  `;
}

function renderSummary() {
  const cards = $("#summaryCards");
  const rows = state.role === "employee" ? state.data.summary.employees.filter((item) => item.employeeId === state.employee.id) : state.data.summary.employees;
  cards.innerHTML = rows
    .map(
      (row) => `
        <article class="summary-card">
          <strong>${escapeHtml(row.name)}</strong>
          <span>Ferien genutzt: ${row.used} Tage</span>
          <span>Rest Jahresferien: ${row.remainingAnnual} Tage</span>
          <span>Uebertrag offen: ${row.remainingCarry} Tage</span>
          ${
            row.remainingCarry > 0
              ? `<span class="warn">Uebertrag bis 31.03. beziehen</span>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function renderVacationList() {
  const list = $("#vacationList");
  const employeeById = new Map(state.data.employees.map((employee) => [employee.id, employee]));
  const vacations = state.data.vacations
    .filter((vacation) => state.role === "admin" || vacation.employeeId === state.employee.id)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!vacations.length) {
    list.innerHTML = `<div class="row"><div>Noch keine Ferieneintraege.</div></div>`;
    return;
  }
  list.innerHTML = vacations
    .map((vacation) => {
      const employee = employeeById.get(vacation.employeeId);
      return `
        <article class="row">
          <div>
            <div class="row-title"><span class="swatch" style="background:${employee?.color || "#2563eb"}"></span>${escapeHtml(employee?.name || "Unbekannt")}</div>
            <div class="row-meta">${formatDate(vacation.startDate)} - ${formatDate(vacation.endDate)}${vacation.note ? ` · ${escapeHtml(vacation.note)}` : ""}</div>
          </div>
          <div class="row-actions">
            <button class="danger" onclick="deleteVacation('${vacation.id}')">Loeschen</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEmployees() {
  if (state.role !== "admin") return;
  const list = $("#employeeList");
  list.innerHTML = state.data.employees
    .filter((employee) => employee.active)
    .map(
      (employee) => `
        <article class="row">
          <div>
            <div class="row-title"><span class="swatch" style="background:${employee.color}"></span>${escapeHtml(employee.name)}</div>
            <div class="row-meta">Code: ${escapeHtml(employee.loginCode)} · ${employee.vacationDays} Ferientage · ${employee.carryoverDays} Tage Uebertrag</div>
          </div>
          <div class="row-actions">
            <button class="secondary" onclick="editEmployeeById('${employee.id}')">Bearbeiten</button>
            <button class="danger" onclick="removeEmployee('${employee.id}')">Deaktivieren</button>
          </div>
        </article>
      `
    )
    .join("");
}

function editEmployeeById(id) {
  const employee = state.data.employees.find((item) => item.id === id);
  if (employee) editEmployee(employee);
}

function editEmployee(employee) {
  const name = prompt("Name", employee.name);
  if (name === null) return;
  const vacationDays = Number(prompt("Ferientage pro Jahr (25-30)", employee.vacationDays));
  if (Number.isNaN(vacationDays)) return;
  const carryoverDays = Number(prompt("Uebertrag aus Vorjahr (0-5)", employee.carryoverDays));
  if (Number.isNaN(carryoverDays)) return;
  const loginCode = prompt("Login-Code", employee.loginCode);
  if (loginCode === null) return;
  updateEmployee({ ...employee, name, vacationDays, carryoverDays, loginCode });
}

function printPdf() {
  buildPrintView();
  window.print();
}

function buildPrintView() {
  const periodLabel = state.period === "h1" ? "1. Halbjahr" : state.period === "h2" ? "2. Halbjahr" : "Ganzes Jahr";
  const rows = state.data.summary.employees
    .map((row) => {
      const entries = row.vacations
        .filter((vacation) => withinPeriod(vacation))
        .map((vacation) => `${formatDate(vacation.startDate)} - ${formatDate(vacation.endDate)} (${vacation.days} T.)`)
        .join("<br>");
      return `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${row.vacationDays}</td>
          <td>${row.carryoverDays}</td>
          <td>${row.used}</td>
          <td>${row.remainingAnnual}</td>
          <td>${entries || "-"}</td>
        </tr>
      `;
    })
    .join("");
  const holidayRows = state.data.holidays
    .filter((holiday) => holiday.date.startsWith(String(state.year)))
    .map((holiday) => `${formatDate(holiday.date)} ${escapeHtml(holiday.name)}${holiday.type === "holidayLike" ? " (feiertagsaehnlich)" : ""}`)
    .join(", ");
  $("#printView").innerHTML = `
    <div class="print-header">
      <div>
        <h1>${escapeHtml(state.data.settings.companyName)}</h1>
        <strong>Ferienuebersicht ${state.year} · ${periodLabel}</strong>
      </div>
      <div>Baar<br>${new Date().toLocaleDateString("de-CH")}</div>
    </div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Mitarbeiter</th>
          <th>Jahresferien</th>
          <th>Uebertrag</th>
          <th>Genutzt</th>
          <th>Rest</th>
          <th>Ferien</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><strong>Feiertage:</strong> ${holidayRows}</p>
  `;
}

function buildPrintView() {
  const employees = state.data.employees.filter((employee) => employee.active);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const yearVacations = state.data.vacations.filter((vacation) => vacation.startDate <= `${state.year}-12-31` && vacation.endDate >= `${state.year}-01-01`);
  const legend = employees
    .map(
      (employee) => `
        <div class="print-legend-item">
          <span class="print-swatch" style="background:${employee.color || "#2563eb"}"></span>
          <span>${escapeHtml(employee.name)}</span>
        </div>
      `
    )
    .join("");
  const rows = state.data.summary.employees
    .map((row) => {
      const entries = row.vacations
        .map((vacation) => `${formatDate(vacation.startDate)} - ${formatDate(vacation.endDate)} (${vacation.days} T.)`)
        .join("<br>");
      return `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${row.vacationDays}</td>
          <td>${row.carryoverDays}</td>
          <td>${row.used}</td>
          <td>${row.remainingAnnual}</td>
          <td>${entries || "-"}</td>
        </tr>
      `;
    })
    .join("");
  const holidayRows = state.data.holidays
    .filter((holiday) => holiday.date.startsWith(String(state.year)))
    .map((holiday) => `${formatDate(holiday.date)} ${escapeHtml(holiday.name)}${holiday.type === "holidayLike" ? " (feiertagsaehnlich)" : ""}`)
    .join(", ");
  $("#printView").innerHTML = `
    <section class="print-page print-year-page">
      <div class="print-header">
        <img class="print-logo" src="/assets/wortmarke.png" alt="Pfarrei St. Wendelin Allenwinden">
        <div class="print-title">
          <h1>Ferienplan ${state.year}</h1>
          <strong>Jahresuebersicht mit Ferien, Feiertagen und Ueberschneidungen</strong>
        </div>
        <div class="print-meta">Baar<br>${new Date().toLocaleDateString("de-CH")}</div>
      </div>

      <div class="print-year-grid">
        ${range(0, 11).map((monthIndex) => renderPrintMonth(monthIndex, yearVacations, employeeById)).join("")}
      </div>

      <div class="print-legend">
        ${legend}
        <div class="print-legend-item"><span class="print-swatch holiday"></span><span>gesetzlicher Feiertag</span></div>
        <div class="print-legend-item"><span class="print-swatch holiday-like"></span><span>feiertagsaehnlicher Tag</span></div>
        <div class="print-legend-item"><span class="print-swatch conflict"></span><span>Ueberschneidung</span></div>
      </div>
    </section>

    <section class="print-page print-detail-page">
      <div class="print-header compact">
        <img class="print-logo small" src="/assets/wortmarke.png" alt="Pfarrei St. Wendelin Allenwinden">
        <div>
          <h1>Ferienuebersicht ${state.year}</h1>
          <strong>Saldo und Detaildaten</strong>
        </div>
        <div class="print-meta">Baar<br>${new Date().toLocaleDateString("de-CH")}</div>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th>Mitarbeiter</th>
            <th>Jahresferien</th>
            <th>Uebertrag</th>
            <th>Genutzt</th>
            <th>Rest</th>
            <th>Ferien</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="print-holidays"><strong>Feiertage:</strong> ${holidayRows}</p>
    </section>
  `;
}

function renderPrintMonth(monthIndex, vacations, employeeById) {
  const first = new Date(state.year, monthIndex, 1);
  const last = new Date(state.year, monthIndex + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(`<div class="print-day empty"></div>`);
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(renderPrintDay(new Date(state.year, monthIndex, day), vacations, employeeById));
  }
  while (cells.length % 7 !== 0) cells.push(`<div class="print-day empty"></div>`);
  return `
    <article class="print-month">
      <h2>${monthNames[monthIndex]}</h2>
      <div class="print-month-grid">
        ${weekdayNames.map((name) => `<div class="print-weekday">${name}</div>`).join("")}
        ${cells.join("")}
      </div>
    </article>
  `;
}

function renderPrintDay(date, allVacations, employeeById) {
  const iso = toIso(date);
  const vacations = allVacations.filter((vacation) => vacation.startDate <= iso && vacation.endDate >= iso);
  const holiday = state.data.holidays.find((item) => item.date === iso);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const classes = ["print-day"];
  if (isWeekend) classes.push("weekend");
  if (holiday?.type === "official") classes.push("holiday");
  if (holiday?.type === "holidayLike") classes.push("holiday-like");
  if (vacations.length > 1) classes.push("conflict");
  const bars = vacations
    .map((vacation) => {
      const employee = employeeById.get(vacation.employeeId);
      return `<span class="print-vacation-bar" style="background:${employee?.color || "#2563eb"}">${employeeInitials(employee?.name || "?")}</span>`;
    })
    .join("");
  return `
    <div class="${classes.join(" ")}">
      <span class="print-date">${date.getDate()}</span>
      ${holiday ? `<span class="print-holiday-name">${escapeHtml(shortHolidayName(holiday.name))}</span>` : ""}
      ${bars}
    </div>
  `;
}

function employeeInitials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function shortHolidayName(name) {
  const map = {
    "Neujahr": "Neuj.",
    "Karfreitag": "Karfr.",
    "Auffahrt": "Auff.",
    "Fronleichnam": "Fronl.",
    "Bundesfeiertag": "1. Aug.",
    "Maria Himmelfahrt": "M. Himm.",
    "Allerheiligen": "Allerh.",
    "Maria Empfaengnis": "M. Empf.",
    "Weihnachten": "Weihn.",
    "Berchtoldstag": "Bercht.",
    "Ostermontag": "OsterM",
    "Pfingstmontag": "PfingstM",
    "Stefanstag": "Stefan"
  };
  return map[name] || name;
}

function withinPeriod(vacation) {
  if (state.period === "year") return true;
  const midpoint = `${state.year}-07-01`;
  return state.period === "h1" ? vacation.startDate < midpoint : vacation.endDate >= midpoint;
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(node.timer);
  node.timer = setTimeout(() => node.classList.remove("show"), 2800);
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-CH");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

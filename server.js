const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.VERCEL ? path.join("/tmp", "ferienplan") : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "ferienplan.json");
const sessions = new Map();
const EMPLOYEE_COLORS = [
  "#004889",
  "#c2410c",
  "#047857",
  "#7c3aed",
  "#be123c",
  "#0f766e",
  "#4338ca",
  "#b45309",
  "#0369a1",
  "#a21caf",
  "#4d7c0f",
  "#dc2626"
];

const todayYear = new Date().getFullYear();

const seed = {
  settings: {
    companyName: "Ferienplan",
    adminPasswordHash: hashPassword(process.env.ADMIN_PASSWORD || "admin123"),
    includeHolidayLikeDays: true
  },
  employees: [
    {
      id: id(),
      name: "Max Muster",
      vacationDays: 25,
      carryoverDays: 0,
      loginCode: "MAX123",
      color: "#0f766e",
      active: true
    }
  ],
  vacations: []
};

function id() {
  return crypto.randomBytes(8).toString("hex");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sanitizeEmployee(employee) {
  return {
    id: employee.id,
    name: employee.name,
    vacationDays: Number(employee.vacationDays),
    carryoverDays: Number(employee.carryoverDays || 0),
    loginCode: employee.loginCode,
    color: employee.color || "#2563eb",
    active: employee.active !== false
  };
}

function colorForEmployee(index) {
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length];
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function holidaysForYear(year, includeHolidayLikeDays) {
  const easter = easterDate(year);
  const official = [
    ["Neujahr", `${year}-01-01`],
    ["Karfreitag", toIso(addDays(easter, -2))],
    ["Auffahrt", toIso(addDays(easter, 39))],
    ["Fronleichnam", toIso(addDays(easter, 60))],
    ["Bundesfeiertag", `${year}-08-01`],
    ["Maria Himmelfahrt", `${year}-08-15`],
    ["Allerheiligen", `${year}-11-01`],
    ["Maria Empfängnis", `${year}-12-08`],
    ["Weihnachten", `${year}-12-25`]
  ].map(([name, date]) => ({ name, date, type: "official" }));

  const holidayLike = [
    ["Berchtoldstag", `${year}-01-02`],
    ["Ostermontag", toIso(addDays(easter, 1))],
    ["Pfingstmontag", toIso(addDays(easter, 50))],
    ["Stefanstag", `${year}-12-26`]
  ].map(([name, date]) => ({ name, date, type: "holidayLike" }));

  return includeHolidayLikeDays ? official.concat(holidayLike) : official;
}

function holidayMap(year, settings) {
  return new Map(holidaysForYear(year, settings.includeHolidayLikeDays).map((day) => [day.date, day]));
}

function workingDaysBetween(start, end, settings) {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return 0;
  let count = 0;
  let cursor = parseDate(start);
  const stop = parseDate(end);
  const maps = new Map();

  while (cursor <= stop) {
    const year = cursor.getFullYear();
    if (!maps.has(year)) maps.set(year, holidayMap(year, settings));
    const weekday = cursor.getDay();
    const iso = toIso(cursor);
    if (weekday !== 0 && weekday !== 6 && !maps.get(year).has(iso)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

function overlap(a, b) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

function buildSummary(data, year = todayYear) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const carryLimit = `${year}-03-31`;
  const vacations = data.vacations.filter((vacation) => vacation.endDate >= start && vacation.startDate <= end);

  const byEmployee = data.employees.map((employee) => {
    const rows = vacations
      .filter((vacation) => vacation.employeeId === employee.id)
      .map((vacation) => ({
        ...vacation,
        days: workingDaysBetween(maxDate(vacation.startDate, start), minDate(vacation.endDate, end), data.settings),
        carryWindowDays: workingDaysBetween(
          maxDate(vacation.startDate, start),
          minDate(vacation.endDate, carryLimit),
          data.settings
        )
      }));
    const used = rows.reduce((sum, vacation) => sum + vacation.days, 0);
    const carryUsed = Math.min(employee.carryoverDays || 0, rows.reduce((sum, vacation) => sum + vacation.carryWindowDays, 0));
    const annualUsed = Math.max(0, used - carryUsed);
    const remainingAnnual = Number(employee.vacationDays || 0) - annualUsed;
    const remainingCarry = Math.max(0, Number(employee.carryoverDays || 0) - carryUsed);
    return {
      employeeId: employee.id,
      name: employee.name,
      vacationDays: employee.vacationDays,
      carryoverDays: employee.carryoverDays || 0,
      used,
      carryUsed,
      annualUsed,
      remainingAnnual,
      remainingCarry,
      vacations: rows
    };
  });

  return { year, employees: byEmployee };
}

function maxDate(a, b) {
  return a > b ? a : b;
}

function minDate(a, b) {
  return a < b ? a : b;
}

function buildOverlaps(data) {
  const alerts = [];
  for (const vacation of data.vacations) {
    const employee = data.employees.find((item) => item.id === vacation.employeeId);
    const conflicts = data.vacations
      .filter((other) => other.id !== vacation.id && other.employeeId !== vacation.employeeId && overlap(vacation, other))
      .map((other) => {
        const otherEmployee = data.employees.find((item) => item.id === other.employeeId);
        return {
          vacationId: other.id,
          employeeId: other.employeeId,
          employeeName: otherEmployee?.name || "Unbekannt",
          startDate: other.startDate,
          endDate: other.endDate
        };
      });
    if (conflicts.length) {
      alerts.push({
        vacationId: vacation.id,
        employeeId: vacation.employeeId,
        employeeName: employee?.name || "Unbekannt",
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        conflicts
      });
    }
  }
  return alerts;
}

function publicData(data, year = todayYear, options = {}) {
  const includeVacations = options.includeVacations === true;
  const includeLoginCodes = options.includeLoginCodes === true;
  return {
    settings: {
      companyName: data.settings.companyName,
      includeHolidayLikeDays: data.settings.includeHolidayLikeDays
    },
    employees: includeVacations
      ? data.employees.map((employee, index) => {
          const clean = sanitizeEmployee(employee);
          clean.color = colorForEmployee(index);
          if (!includeLoginCodes) delete clean.loginCode;
          return clean;
        })
      : [],
    vacations: includeVacations ? data.vacations : [],
    overlaps: includeVacations ? buildOverlaps(data) : [],
    summary: includeVacations ? buildSummary(data, year) : { year, employees: [] },
    holidays: holidaysForYear(Number(year), data.settings.includeHolidayLikeDays)
  };
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index > -1) cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function createSession(payload) {
  const token = id() + id();
  sessions.set(token, { ...payload, createdAt: Date.now() });
  return token;
}

function getSession(req) {
  const token = parseCookies(req).ferien_session;
  if (!token) return null;
  return sessions.get(token) || null;
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `ferien_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
}

function clearSessionCookie(req, res) {
  const token = parseCookies(req).ferien_session;
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "ferien_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function requireAdmin(req, res, next) {
  const data = readData();
  const password = req.headers["x-admin-password"] || "";
  const session = getSession(req);
  if (session?.role !== "admin" && hashPassword(password) !== data.settings.adminPasswordHash) {
    return res.status(401).json({ error: "Admin-Passwort ist falsch." });
  }
  req.data = data;
  req.session = session;
  next();
}

function employeeFromCode(data, code) {
  return data.employees.find((employee) => employee.active !== false && employee.loginCode.toUpperCase() === String(code || "").toUpperCase());
}

app.use(express.json({ limit: "1mb" }));
app.get("/assets/wortmarke.png", (req, res) => {
  res.sendFile(path.join(__dirname, "wortmarke_3.png"));
});
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/public", (req, res) => {
  const data = readData();
  const year = Number(req.query.year || todayYear);
  res.json(publicData(data, year));
});

app.post("/api/admin/login", requireAdmin, (req, res) => {
  if (!req.session) setSessionCookie(res, createSession({ role: "admin" }));
  res.json({ ok: true, data: publicData(req.data, Number(req.body.year || todayYear), { includeVacations: true, includeLoginCodes: true }) });
});

app.get("/api/session", (req, res) => {
  const data = readData();
  const session = getSession(req);
  const year = Number(req.query.year || todayYear);
  if (!session) return res.status(401).json({ error: "Keine aktive Sitzung." });
  if (session.role === "admin") {
    return res.json({ role: "admin", data: publicData(data, year, { includeVacations: true, includeLoginCodes: true }) });
  }
  const employee = data.employees.find((item) => item.id === session.employeeId && item.active !== false);
  if (!employee) return res.status(401).json({ error: "Keine aktive Sitzung." });
  res.json({ role: "employee", employee: sanitizeEmployee(employee), data: publicData(data, year, { includeVacations: true }) });
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const data = req.data;
  data.settings.companyName = String(req.body.companyName || "Ferienplan").slice(0, 80);
  data.settings.includeHolidayLikeDays = Boolean(req.body.includeHolidayLikeDays);
  if (req.body.newPassword) data.settings.adminPasswordHash = hashPassword(req.body.newPassword);
  writeData(data);
  res.json(publicData(data, Number(req.body.year || todayYear), { includeVacations: true, includeLoginCodes: true }));
});

app.post("/api/admin/employees", requireAdmin, (req, res) => {
  const data = req.data;
  const employee = sanitizeEmployee({
    id: id(),
    name: String(req.body.name || "").trim(),
    vacationDays: clamp(Number(req.body.vacationDays || 25), 25, 30),
    carryoverDays: clamp(Number(req.body.carryoverDays || 0), 0, 5),
    loginCode: makeLoginCode(data, req.body.name),
    color: colorForEmployee(data.employees.length),
    active: true
  });
  if (!employee.name) return res.status(400).json({ error: "Name fehlt." });
  data.employees.push(employee);
  writeData(data);
  res.json(publicData(data, Number(req.body.year || todayYear), { includeVacations: true, includeLoginCodes: true }));
});

app.put("/api/admin/employees/:id", requireAdmin, (req, res) => {
  const data = req.data;
  const employee = data.employees.find((item) => item.id === req.params.id);
  if (!employee) return res.status(404).json({ error: "Mitarbeiter nicht gefunden." });
  employee.name = String(req.body.name || employee.name).trim();
  employee.vacationDays = clamp(Number(req.body.vacationDays ?? employee.vacationDays), 25, 30);
  employee.carryoverDays = clamp(Number(req.body.carryoverDays ?? employee.carryoverDays), 0, 5);
  employee.loginCode = String(req.body.loginCode || employee.loginCode).trim().toUpperCase().slice(0, 20);
  employee.color = String(req.body.color || employee.color);
  employee.active = req.body.active !== false;
  writeData(data);
  res.json(publicData(data, Number(req.body.year || todayYear), { includeVacations: true, includeLoginCodes: true }));
});

app.delete("/api/admin/employees/:id", requireAdmin, (req, res) => {
  const data = req.data;
  const employee = data.employees.find((item) => item.id === req.params.id);
  if (!employee) return res.status(404).json({ error: "Mitarbeiter nicht gefunden." });
  employee.active = false;
  writeData(data);
  res.json(publicData(data, Number(req.query.year || todayYear), { includeVacations: true, includeLoginCodes: true }));
});

app.post("/api/employee/login", (req, res) => {
  const data = readData();
  const employee = employeeFromCode(data, req.body.loginCode);
  if (!employee) return res.status(401).json({ error: "Login-Code nicht gefunden." });
  setSessionCookie(res, createSession({ role: "employee", employeeId: employee.id }));
  const cleanEmployee = sanitizeEmployee(employee);
  res.json({ employee: cleanEmployee, data: publicData(data, Number(req.body.year || todayYear), { includeVacations: true }) });
});

app.post("/api/vacations", (req, res) => {
  const data = readData();
  const adminPassword = req.headers["x-admin-password"];
  const session = getSession(req);
  const isAdmin = session?.role === "admin" || (adminPassword && hashPassword(adminPassword) === data.settings.adminPasswordHash);
  const employee = isAdmin
    ? data.employees.find((item) => item.id === req.body.employeeId)
    : session?.role === "employee"
      ? data.employees.find((item) => item.id === session.employeeId && item.active !== false)
      : employeeFromCode(data, req.headers["x-employee-code"]);

  if (!employee) return res.status(401).json({ error: "Keine Berechtigung." });
  const employeeId = isAdmin ? req.body.employeeId : employee.id;
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    return res.status(400).json({ error: "Bitte gültiges Start- und Enddatum erfassen." });
  }

  const vacation = {
    id: id(),
    employeeId,
    startDate,
    endDate,
    note: String(req.body.note || "").trim().slice(0, 160),
    createdAt: new Date().toISOString()
  };
  data.vacations.push(vacation);
  writeData(data);
  res.json(publicData(data, Number(req.body.year || startDate.slice(0, 4)), { includeVacations: true, includeLoginCodes: isAdmin }));
});

app.put("/api/vacations/:id", (req, res) => {
  const data = readData();
  const adminPassword = req.headers["x-admin-password"];
  const session = getSession(req);
  const isAdmin = session?.role === "admin" || (adminPassword && hashPassword(adminPassword) === data.settings.adminPasswordHash);
  const employee = session?.role === "employee"
    ? data.employees.find((item) => item.id === session.employeeId && item.active !== false)
    : employeeFromCode(data, req.headers["x-employee-code"]);
  const vacation = data.vacations.find((item) => item.id === req.params.id);
  if (!vacation) return res.status(404).json({ error: "Ferieneintrag nicht gefunden." });
  if (!isAdmin && (!employee || employee.id !== vacation.employeeId)) return res.status(401).json({ error: "Keine Berechtigung." });

  if (req.body.startDate) vacation.startDate = req.body.startDate;
  if (req.body.endDate) vacation.endDate = req.body.endDate;
  if (!isIsoDate(vacation.startDate) || !isIsoDate(vacation.endDate) || vacation.startDate > vacation.endDate) {
    return res.status(400).json({ error: "Bitte gültiges Start- und Enddatum erfassen." });
  }
  vacation.note = String(req.body.note || vacation.note || "").trim().slice(0, 160);
  writeData(data);
  res.json(publicData(data, Number(req.body.year || vacation.startDate.slice(0, 4)), { includeVacations: true, includeLoginCodes: isAdmin }));
});

app.delete("/api/vacations/:id", (req, res) => {
  const data = readData();
  const adminPassword = req.headers["x-admin-password"];
  const session = getSession(req);
  const isAdmin = session?.role === "admin" || (adminPassword && hashPassword(adminPassword) === data.settings.adminPasswordHash);
  const employee = session?.role === "employee"
    ? data.employees.find((item) => item.id === session.employeeId && item.active !== false)
    : employeeFromCode(data, req.headers["x-employee-code"]);
  const vacation = data.vacations.find((item) => item.id === req.params.id);
  if (!vacation) return res.status(404).json({ error: "Ferieneintrag nicht gefunden." });
  if (!isAdmin && (!employee || employee.id !== vacation.employeeId)) return res.status(401).json({ error: "Keine Berechtigung." });
  data.vacations = data.vacations.filter((item) => item.id !== req.params.id);
  writeData(data);
  res.json(publicData(data, Number(req.query.year || vacation.startDate.slice(0, 4)), { includeVacations: true, includeLoginCodes: isAdmin }));
});

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function makeLoginCode(data, name) {
  const prefix = String(name || "MA")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase() || "MA";
  let code = "";
  do {
    code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
  } while (data.employees.some((employee) => employee.loginCode === code));
  return code;
}

function randomColor() {
  return EMPLOYEE_COLORS[Math.floor(Math.random() * EMPLOYEE_COLORS.length)];
}

ensureDataFile();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Ferienplan läuft auf http://localhost:${PORT}`);
    console.log("Erster Admin-Login: Passwort admin123 (bitte im Admin-Bereich ändern).");
  });
}

module.exports = app;

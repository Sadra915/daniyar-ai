// memory-manager.js
// حافظه‌ی سه‌سطحی:
//   1. User Memory   → واقعیت‌های کلی و همیشگی درباره‌ی کاربر
//   2. Project Memory → هر پروژه حافظه‌ی مستقل خودش (معماری، تصمیمات، وضعیت فعلی، کارها)
//   3. Session (Active Project) → این‌که الان کدوم پروژه «فعاله»؛ وقتی فعاله،
//      حافظه‌ی همون پروژه به‌عنوان context اضافه می‌شه (ایده از نسخه‌ی قبلی دانیار)
//
// همه‌چیز JSON ساده روی دیسکه؛ از public UI (صفحه‌ی حافظه) هم قابل دیدن/ویرایش/حذفه.

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, 'memory');
const USER_MEMORY_PATH = path.join(MEMORY_DIR, 'user.json');
const SESSION_PATH = path.join(MEMORY_DIR, 'session.json');
const PROJECTS_DIR = path.join(MEMORY_DIR, 'projects');

function ensureDirs() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  if (!fs.existsSync(USER_MEMORY_PATH)) writeJSON(USER_MEMORY_PATH, { facts: [] });
  if (!fs.existsSync(SESSION_PATH)) writeJSON(SESSION_PATH, { activeProject: null });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// --- User memory ---

function getUserMemory() {
  ensureDirs();
  return readJSON(USER_MEMORY_PATH, { facts: [] });
}

function addUserFact(fact) {
  ensureDirs();
  const mem = getUserMemory();
  const entry = { id: newId(), text: fact, ts: new Date().toISOString() };
  mem.facts.push(entry);
  writeJSON(USER_MEMORY_PATH, mem);
  return entry;
}

function deleteUserFact(id) {
  ensureDirs();
  const mem = getUserMemory();
  mem.facts = mem.facts.filter(f => f.id !== id);
  writeJSON(USER_MEMORY_PATH, mem);
  return { deleted: id };
}

// --- Project memory ---

function slug(name) {
  return name.trim().replace(/[^a-zA-Z0-9آ-ی_-]/g, '_');
}

function projectPath(name) {
  return path.join(PROJECTS_DIR, `${slug(name)}.json`);
}

function emptyProject(name) {
  return {
    name,
    architecture: '',
    decisions: [],       // [{id, text, ts}]
    completedTasks: [],
    pendingTasks: [],
    knownIssues: [],
    importantFiles: [],
    state: '',           // خلاصه‌ی وضعیت فعلی، یک‌خطی
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

function getProjectMemory(name) {
  ensureDirs();
  return readJSON(projectPath(name), emptyProject(name));
}

function projectExists(name) {
  ensureDirs();
  return fs.existsSync(projectPath(name));
}

function createProject(name) {
  ensureDirs();
  if (projectExists(name)) return getProjectMemory(name);
  const proj = emptyProject(name);
  writeJSON(projectPath(name), proj);
  return proj;
}

function updateProjectMemory(name, patch) {
  ensureDirs();
  const mem = getProjectMemory(name);
  const merged = { ...mem, ...patch, updatedAt: new Date().toISOString() };
  writeJSON(projectPath(name), merged);
  return merged;
}

function addProjectFact(name, text) {
  ensureDirs();
  const mem = getProjectMemory(name);
  const entry = { id: newId(), text, ts: new Date().toISOString() };
  mem.decisions.push(entry);
  mem.updatedAt = new Date().toISOString();
  writeJSON(projectPath(name), mem);
  return entry;
}

function deleteProjectFact(name, id) {
  ensureDirs();
  const mem = getProjectMemory(name);
  mem.decisions = mem.decisions.filter(f => f.id !== id);
  writeJSON(projectPath(name), mem);
  return { deleted: id };
}

function deleteProject(name) {
  ensureDirs();
  const p = projectPath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  const session = getSession();
  if (session.activeProject === name) setActiveProject(null);
  return { deleted: name };
}

function listProjects() {
  ensureDirs();
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => readJSON(path.join(PROJECTS_DIR, f), null))
    .filter(Boolean);
}

// --- Session (active project) ---
// وقتی کاربر گفت "روی پروژه‌ی X کار می‌کنم"، دانیار با ابزار switch_project پروژه رو
// فعال می‌کنه و از اون به بعد حافظه‌ی همون پروژه خودکار به‌عنوان context در
// system prompt حاضره — بدون این‌که همه‌ی پروژه‌ها با هم قاطی بشن.

function getSession() {
  ensureDirs();
  return readJSON(SESSION_PATH, { activeProject: null });
}

function setActiveProject(name) {
  ensureDirs();
  if (name && !projectExists(name)) createProject(name);
  writeJSON(SESSION_PATH, { activeProject: name || null });
  return getSession();
}

module.exports = {
  getUserMemory,
  addUserFact,
  deleteUserFact,
  getProjectMemory,
  createProject,
  updateProjectMemory,
  addProjectFact,
  deleteProjectFact,
  deleteProject,
  listProjects,
  getSession,
  setActiveProject,
};

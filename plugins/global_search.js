// plugins/global_search.js — «جستجوی سراسری» از سند اصلی: یک جست‌وجوی واقعی
// (نه معنایی/Embedding، بلکه matching متنی ساده) روی چیزهایی که واقعاً داریم:
// فایل‌های workspace (اسم + محتوا)، یادداشت‌ها، کارها، و حافظه‌ی پروژه‌ها.
// Chat history و Research history (که سند بهشون اشاره کرده) هنوز به‌صورت
// جست‌وجوپذیر ذخیره نمی‌شن، برای همین این‌جا شامل نیستن.
const fs = require('fs');
const path = require('path');
const { WORKSPACE } = require('./_workspace-utils');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const MAX_FILE_BYTES = 200 * 1024; // فایل‌های خیلی بزرگ رو برای سرعت، از محتوا رد می‌کنیم

function walkFiles(dir, depth = 0) {
  if (depth > 5) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  let out = [];
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.git') || e.name === '.snapshots') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkFiles(full, depth + 1));
    else out.push(full);
  }
  return out;
}

module.exports = {
  name: 'global_search',
  description: 'یک عبارت را در اسم/محتوای فایل‌های workspace، یادداشت‌ها، کارها و حافظه‌ی پروژه‌ها جست‌وجو کن.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  permission: 'green',
  handler: async ({ query }) => {
    const q = query.toLowerCase();
    const hits = [];

    // فایل‌های workspace
    for (const full of walkFiles(WORKSPACE)) {
      const rel = path.relative(WORKSPACE, full);
      if (rel.toLowerCase().includes(q)) {
        hits.push(`📁 فایل: ${rel} (تطابق در اسم)`);
        continue;
      }
      try {
        const stat = fs.statSync(full);
        if (stat.size > MAX_FILE_BYTES) continue;
        const content = fs.readFileSync(full, 'utf8');
        const idx = content.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const snippet = content.slice(Math.max(0, idx - 40), idx + 60).replace(/\n/g, ' ');
          hits.push(`📁 فایل: ${rel} — «...${snippet}...»`);
        }
      } catch { /* فایل باینری یا غیرقابل‌خواندن، نادیده بگیر */ }
      if (hits.length >= 30) break;
    }

    // یادداشت‌ها و کارها
    for (const f of ['notes.json', 'todos.json']) {
      const p = path.join(MEMORY_DIR, f);
      if (!fs.existsSync(p)) continue;
      try {
        const list = JSON.parse(fs.readFileSync(p, 'utf8'));
        for (const item of list) {
          const text = JSON.stringify(item).toLowerCase();
          if (text.includes(q)) hits.push(`📝 ${f === 'notes.json' ? 'یادداشت' : 'کار'}: ${item.title || item.task || item.id}`);
        }
      } catch { /* نادیده بگیر */ }
    }

    // حافظه‌ی پروژه‌ها
    const projectsDir = path.join(MEMORY_DIR, 'projects');
    if (fs.existsSync(projectsDir)) {
      for (const f of fs.readdirSync(projectsDir)) {
        try {
          const proj = JSON.parse(fs.readFileSync(path.join(projectsDir, f), 'utf8'));
          const text = JSON.stringify(proj).toLowerCase();
          if (text.includes(q)) hits.push(`📋 حافظه‌ی پروژه: ${proj.name || f}`);
        } catch { /* نادیده بگیر */ }
      }
    }

    if (hits.length === 0) return `چیزی برای «${query}» پیدا نشد.`;
    return hits.slice(0, 30).join('\n');
  },
};

// plugins/search_code.js — grep واقعی روی فایل‌های کد یک پروژه، با شماره خط دقیق.
// فرق با global_search: اون برای جست‌وجوی عمومی (یادداشت/کار/حافظه) هم هست،
// این یکی مخصوص کده — regex واقعی، خروجی file:line، و node_modules/.git رد می‌شن.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

const SKIP_DIRS = new Set(['node_modules', '.git', '.snapshots', 'dist', 'build', '__pycache__', 'target', '.venv']);
const MAX_RESULTS = 100;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // فایل‌های خیلی بزرگ (باینری احتمالی) رد می‌شن

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
}

module.exports = {
  name: 'search_code',
  description:
    'داخل فایل‌های یک پوشه (پروژه یا کل workspace) دنبال یک regex بگرد و نتایج را به‌شکل مسیر:شماره‌خط برگردان ' +
    '(مثل grep -rn). برای پیدا کردن جای یک تابع/متغیر/import قبل از edit_file استفاده کن.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'عبارت جست‌وجو یا regex (بدون / در ابتدا و انتها)' },
      folder: { type: 'string', description: 'مسیر نسبی داخل workspace برای جست‌وجو، پیش‌فرض ریشه' },
      caseSensitive: { type: 'boolean', description: 'پیش‌فرض false' },
      filePattern: { type: 'string', description: 'فقط فایل‌هایی که اسمشان شامل این رشته باشد (مثل ".js" یا ".py")' },
    },
    required: ['pattern'],
  },
  permission: 'green',
  handler: async ({ pattern, folder, caseSensitive = false, filePattern }) => {
    const dir = safePath(folder || '.');
    if (!fs.existsSync(dir)) return `خطا: مسیر پیدا نشد: ${folder}`;

    let regex;
    try {
      regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    } catch (err) {
      return `خطا: regex نامعتبر است: ${err.message}`;
    }

    const files = [];
    walk(dir, files);
    const filtered = filePattern ? files.filter((f) => f.includes(filePattern)) : files;

    const results = [];
    let filesSearched = 0;
    for (const file of filtered) {
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_SIZE) continue;

      let content;
      try {
        content = fs.readFileSync(file, 'utf8');
      } catch {
        continue; // احتمالاً باینری
      }
      filesSearched++;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) {
          const rel = path.relative(dir, file) || path.basename(file);
          results.push(`${folder ? `${folder}/` : ''}${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
          if (results.length >= MAX_RESULTS) break;
        }
      }
      if (results.length >= MAX_RESULTS) break;
    }

    if (results.length === 0) return `چیزی پیدا نشد (${filesSearched} فایل بررسی شد).`;
    const truncated = results.length >= MAX_RESULTS ? `\n...[بریده شد، بیش از ${MAX_RESULTS} نتیجه]` : '';
    return `${results.length} نتیجه در ${filesSearched} فایل:\n${results.join('\n')}${truncated}`;
  },
};

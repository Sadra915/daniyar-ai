// plugins/db_lab.js — بخش «Database Lab» سند اصلی، برای SQLite (فایل‌محور، بدون سرور جدا،
// برخلاف PostgreSQL/MySQL که نیاز به سرویس جدا و اتصال شبکه دارن و اینجا پیاده نشدن).
// از better-sqlite3 استفاده می‌کنه (باید در package.json اضافه بشه و npm install بشه).
// اگه پکیج نصب نباشه، به‌جای کرش کردن یا وانمود کردن، همین رو صریح می‌گه.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

function loadDriver() {
  try {
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

module.exports = {
  name: 'db_lab',
  description:
    'روی یک فایل دیتابیس SQLite داخل workspace کار کن: schema (لیست جدول‌ها و ستون‌ها)، ' +
    'query (اجرای یک SQL دلخواه — SELECT یا هر DDL/DML دیگر)، suggest_indexes (پیشنهاد ساده‌ی Index بر اساس Foreign Key/ستون‌های بدون Index). ' +
    'اگر فایل دیتابیس وجود نداشته باشد، با اولین query ساخته می‌شود. PostgreSQL/MySQL پشتیبانی نمی‌شوند (نیاز به سرویس جدا دارند).',
  input_schema: {
    type: 'object',
    properties: {
      dbPath: { type: 'string', description: 'مسیر نسبی فایل .sqlite/.db داخل workspace' },
      action: { type: 'string', enum: ['schema', 'query', 'suggest_indexes'] },
      sql: { type: 'string', description: 'فقط برای action=query' },
    },
    required: ['dbPath', 'action'],
  },
  permission: 'yellow',
  handler: async ({ dbPath, action, sql }) => {
    const Database = loadDriver();
    if (!Database) {
      return 'SQLite در این دستگاه فعال نیست چون better-sqlite3 یک native addon است و برای Termux/Android باید جداگانه build شود. این پلاگین عمداً کرش نمی‌کند؛ برای استفاده روی دسکتاپ dependency را نصب کن.';
    }

    const full = safePath(dbPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });

    let db;
    try {
      db = new Database(full);
    } catch (err) {
      return `خطا در باز کردن دیتابیس: ${err.message}`;
    }

    try {
      if (action === 'schema') {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        if (tables.length === 0) return '(هنوز هیچ جدولی در این دیتابیس نیست)';
        const parts = tables.map((t) => {
          const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
          const colStr = cols.map((c) => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.notnull ? ' NOT NULL' : ''}`).join(', ');
          return `${t.name}(${colStr})`;
        });
        return parts.join('\n');
      }

      if (action === 'query') {
        if (!sql) return 'خطا: برای query باید sql داده شود.';
        const trimmed = sql.trim().toLowerCase();
        if (trimmed.startsWith('select') || trimmed.startsWith('pragma')) {
          const rows = db.prepare(sql).all();
          if (rows.length === 0) return '(بدون نتیجه)';
          const limited = rows.slice(0, 200);
          const truncNote = rows.length > 200 ? `\n...[${rows.length - 200} ردیف دیگر، بریده شد]` : '';
          return JSON.stringify(limited, null, 2) + truncNote;
        }
        const info = db.prepare(sql).run();
        return `اجرا شد. تغییرات: ${info.changes}${info.lastInsertRowid ? `, lastInsertRowid: ${info.lastInsertRowid}` : ''}`;
      }

      if (action === 'suggest_indexes') {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        const suggestions = [];
        for (const t of tables) {
          const fks = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all();
          const existingIdx = db.prepare(`PRAGMA index_list(${t.name})`).all();
          const indexedCols = new Set();
          for (const idx of existingIdx) {
            for (const c of db.prepare(`PRAGMA index_info(${idx.name})`).all()) indexedCols.add(c.name);
          }
          for (const fk of fks) {
            if (!indexedCols.has(fk.from)) {
              suggestions.push(`CREATE INDEX idx_${t.name}_${fk.from} ON ${t.name}(${fk.from}); -- Foreign Key بدون Index`);
            }
          }
        }
        return suggestions.length ? suggestions.join('\n') : '(چیز خاصی برای پیشنهاد پیدا نشد — Foreign Keyهای بدون Index دیده نشدند)';
      }

      return 'خطا: action نامعتبر است.';
    } catch (err) {
      return `خطا در اجرای عملیات: ${err.message}`;
    } finally {
      db.close();
    }
  },
};

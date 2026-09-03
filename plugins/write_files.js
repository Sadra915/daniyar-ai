// plugins/write_files.js — ساخت چند فایل هم‌زمان با یک فراخوانی (به‌جای چند بار صدا زدن write_file).
// بیشتر برای اسکفولد اولیه‌ی یک پروژه (چند فایل با هم) یا تغییرات هم‌زمان روی چند فایل کاربرد داره.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'write_files',
  description:
    'چند فایل را هم‌زمان در workspace بساز یا کامل بازنویسی کن — برای اسکفولد اولیه‌ی یک پروژه ' +
    '(مثلاً ساخت ۵-۶ فایل یک پروژه‌ی جدید در یک اقدام، به‌جای صدا زدن write_file به‌تعداد فایل‌ها).',
  input_schema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description: 'لیست فایل‌هایی که باید ساخته/بازنویسی شوند',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'مسیر نسبی فایل داخل workspace' },
            content: { type: 'string', description: 'محتوای کامل فایل' },
          },
          required: ['path', 'content'],
        },
      },
    },
    required: ['files'],
  },
  permission: 'yellow',
  handler: async ({ files }) => {
    if (!Array.isArray(files) || files.length === 0) return 'خطا: حداقل یک فایل لازم است.';
    if (files.length > 50) return 'خطا: حداکثر ۵۰ فایل در یک فراخوانی مجاز است.';

    const results = [];
    for (const f of files) {
      try {
        if (!f.path) { results.push('❌ (بدون مسیر) — رد شد'); continue; }
        const full = safePath(f.path);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, f.content ?? '', 'utf8');
        results.push(`✅ ${f.path} (${(f.content ?? '').length} بایت)`);
      } catch (err) {
        results.push(`❌ ${f.path}: ${err.message}`);
      }
    }
    return `${results.filter((r) => r.startsWith('✅')).length}/${files.length} فایل ساخته شد:\n${results.join('\n')}`;
  },
};

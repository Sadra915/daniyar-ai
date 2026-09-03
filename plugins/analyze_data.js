// plugins/analyze_data.js — نسخه‌ی حداقلی «Data Lab» از سند اصلی: تعداد ردیف،
// ستون‌ها، و آمار پایه (min/max/avg) برای ستون‌های عددی یک فایل CSV یا JSON.
const fs = require('fs');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'analyze_data',
  description: 'یک فایل CSV یا JSON داخل workspace را تحلیل کن: تعداد ردیف، لیست ستون‌ها، و آمار min/max/avg برای ستون‌های عددی.',
  input_schema: {
    type: 'object',
    properties: { filePath: { type: 'string' } },
    required: ['filePath'],
  },
  permission: 'green',
  handler: async ({ filePath }) => {
    try {
      const full = safePath(filePath);
      if (!fs.existsSync(full)) return `خطا: فایل پیدا نشد: ${filePath}`;
      const raw = fs.readFileSync(full, 'utf8');

      let rows;
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(raw);
        rows = Array.isArray(data) ? data : [data];
      } else {
        const lines = raw.trim().split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());
        rows = lines.slice(1).map((line) => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i]?.trim(); });
          return obj;
        });
      }

      if (rows.length === 0) return 'خطا: داده‌ای پیدا نشد.';
      const columns = Object.keys(rows[0]);
      const lines = [`تعداد ردیف: ${rows.length}`, `ستون‌ها: ${columns.join(', ')}`, ''];

      for (const col of columns) {
        const nums = rows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n));
        if (nums.length === rows.length && nums.length > 0) {
          const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
          lines.push(`- ${col} (عددی): min=${Math.min(...nums)} max=${Math.max(...nums)} avg=${avg}`);
        } else {
          lines.push(`- ${col} (متنی)`);
        }
      }

      return lines.join('\n');
    } catch (err) {
      return `خطا در تحلیل داده: ${err.message}`;
    }
  },
};

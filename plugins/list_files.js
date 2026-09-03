const fs = require('fs');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'list_files',
  description: 'لیست فایل‌ها و پوشه‌های داخل یک مسیر در workspace را نشان بده.',
  input_schema: {
    type: 'object',
    properties: { path: { type: 'string', description: 'مسیر نسبی داخل workspace، پیش‌فرض ریشه' } },
  },
  permission: 'green',
  handler: async ({ path: relPath }) => {
    const full = safePath(relPath || '.');
    if (!fs.existsSync(full)) return `خطا: مسیر پیدا نشد: ${relPath}`;
    const entries = fs.readdirSync(full, { withFileTypes: true });
    return entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n') || '(خالی)';
  },
};

const fs = require('fs');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'read_file',
  description: 'محتوای یک فایل متنی را از داخل workspace بخوان.',
  input_schema: {
    type: 'object',
    properties: { path: { type: 'string', description: 'مسیر نسبی فایل داخل workspace' } },
    required: ['path'],
  },
  permission: 'green',
  handler: async ({ path: relPath }) => {
    const full = safePath(relPath);
    if (!fs.existsSync(full)) return `خطا: فایل پیدا نشد: ${relPath}`;
    const content = fs.readFileSync(full, 'utf8');
    return content.length > 20000 ? content.slice(0, 20000) + '\n...[بریده شد]' : content;
  },
};

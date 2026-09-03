const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'write_file',
  description: 'یک فایل جدید در workspace بساز یا فایل موجود را کامل بازنویسی کن.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'مسیر نسبی فایل داخل workspace' },
      content: { type: 'string', description: 'محتوای کامل فایل' },
    },
    required: ['path', 'content'],
  },
  permission: 'yellow', // نیاز به تایید کاربر قبل از اجرا (فرانت‌اند این را اعمال می‌کند)
  handler: async ({ path: relPath, content }) => {
    const full = safePath(relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    return `فایل ذخیره شد: ${relPath} (${content.length} بایت)`;
  },
};

// plugins/manage_file.js — عملیات مدیریت فایل که در write_file/read_file/list_files نبود:
// حذف، جابه‌جایی/تغییرنام، کپی. مکمل edit_file و write_files برای کار واقعی روی یک پروژه.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'manage_file',
  description:
    'یک فایل یا پوشه را در workspace حذف کن (delete)، جابه‌جا/تغییرنام بده (move) یا کپی کن (copy). ' +
    'برای move و copy باید destination هم داده شود.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['delete', 'move', 'copy'] },
      path: { type: 'string', description: 'مسیر نسبی فایل/پوشه‌ی مبدأ داخل workspace' },
      destination: { type: 'string', description: 'مسیر نسبی مقصد (فقط برای move/copy)' },
    },
    required: ['action', 'path'],
  },
  permission: 'red',
  handler: async ({ action, path: relPath, destination }) => {
    const src = safePath(relPath);
    if (!fs.existsSync(src)) return `خطا: مسیر پیدا نشد: ${relPath}`;

    if (action === 'delete') {
      const isDir = fs.statSync(src).isDirectory();
      fs.rmSync(src, { recursive: true, force: true });
      return `${isDir ? 'پوشه' : 'فایل'} حذف شد: ${relPath}`;
    }

    if (action === 'move' || action === 'copy') {
      if (!destination) return `خطا: برای ${action} باید destination داده شود.`;
      const dest = safePath(destination);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (fs.existsSync(dest)) return `خطا: مقصد از قبل وجود دارد: ${destination}`;

      if (action === 'move') {
        fs.renameSync(src, dest);
        return `جابه‌جا شد: ${relPath} → ${destination}`;
      }
      fs.cpSync(src, dest, { recursive: true });
      return `کپی شد: ${relPath} → ${destination}`;
    }

    return 'خطا: action نامعتبر است.';
  },
};

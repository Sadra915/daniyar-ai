// plugins/export_project.js — «خروجی نهایی پروژه» از سند اصلی: یک ZIP قابل دانلود
// از یک پوشه‌ی پروژه‌ی داخل workspace می‌سازد (مثل .snapshots را حذف می‌کند تا شلوغ نشود).
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'export_project',
  description:
    'یک پوشه‌ی پروژه‌ی داخل workspace را به یک فایل ZIP قابل دانلود تبدیل کن (خروجی نهایی). ' +
    'خروجی در workspace/exports/ ساخته می‌شود و از مسیر /api/download در دسترس است.',
  input_schema: {
    type: 'object',
    properties: {
      projectFolder: { type: 'string' },
      outputName: { type: 'string', description: 'اسم فایل ZIP خروجی (اختیاری، پیش‌فرض اسم پروژه است)' },
    },
    required: ['projectFolder'],
  },
  permission: 'green',
  handler: async ({ projectFolder, outputName }) => {
    try {
      const projectDir = safePath(projectFolder);
      if (!fs.existsSync(projectDir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

      const name = (outputName || `${path.basename(projectFolder)}-final`).replace(/[^\w\-.]/g, '_');
      const exportsDir = safePath('exports');
      fs.mkdirSync(exportsDir, { recursive: true });
      const outPath = path.join(exportsDir, `${name}.zip`);

      const zip = new AdmZip();
      zip.addLocalFolder(projectDir, '', (entryPath) => !entryPath.includes('.snapshots'));
      zip.writeZip(outPath);

      const relOut = `exports/${name}.zip`;
      return `خروجی نهایی ساخته شد: workspace/${relOut}\nلینک دانلود: /api/download?path=${encodeURIComponent(relOut)}`;
    } catch (err) {
      return `خطا در ساخت خروجی: ${err.message}`;
    }
  },
};

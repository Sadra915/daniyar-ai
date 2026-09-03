// plugins/zip_files.js — زیپ‌کردن یک لیست انتخابی از فایل‌ها/پوشه‌ها (نه لزوماً یک پروژه‌ی کامل).
// فرق با export_project: اون یک پوشه‌ی پروژه‌ی کامل رو خروجی می‌گیره،
// این یکی برای وقتیه که فقط چند فایل/پوشه‌ی خاص باید با هم بسته‌بندی بشن.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'zip_files',
  description:
    'یک لیست انتخابی از فایل‌ها و/یا پوشه‌ها را داخل workspace به یک فایل ZIP بسته‌بندی کن. ' +
    'برای خروجی کامل یک پروژه از export_project استفاده کن؛ این ابزار برای زیپ‌کردن چند فایل/پوشه‌ی خاص است.',
  input_schema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'لیست مسیرهای نسبی فایل یا پوشه داخل workspace',
      },
      outputName: { type: 'string', description: 'اسم فایل ZIP خروجی (بدون پسوند)' },
    },
    required: ['paths', 'outputName'],
  },
  permission: 'green',
  handler: async ({ paths, outputName }) => {
    if (!Array.isArray(paths) || paths.length === 0) return 'خطا: حداقل یک مسیر لازم است.';

    const zip = new AdmZip();
    const added = [];
    const missing = [];

    for (const p of paths) {
      const full = safePath(p);
      if (!fs.existsSync(full)) { missing.push(p); continue; }
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        zip.addLocalFolder(full, path.basename(p));
      } else {
        zip.addLocalFile(full, path.dirname(p) === '.' ? '' : path.dirname(p));
      }
      added.push(p);
    }

    if (added.length === 0) return `خطا: هیچ‌کدام از مسیرها پیدا نشدند: ${missing.join(', ')}`;

    const name = outputName.replace(/[^\w\-.]/g, '_');
    const exportsDir = safePath('exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    const outPath = path.join(exportsDir, `${name}.zip`);
    zip.writeZip(outPath);

    const relOut = `exports/${name}.zip`;
    let msg = `ZIP ساخته شد: workspace/${relOut}\nلینک دانلود: /api/download?path=${encodeURIComponent(relOut)}\nموارد اضافه‌شده: ${added.join(', ')}`;
    if (missing.length) msg += `\nپیدا نشدند (رد شدند): ${missing.join(', ')}`;
    return msg;
  },
};

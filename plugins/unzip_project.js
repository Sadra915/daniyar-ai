// plugins/unzip_project.js — «ZIP را بده، پروژه را بررسی کن» از سند اصلی.
// کاربر یک ZIP را از UI آپلود می‌کند (که مستقیماً در workspace/ می‌نشیند)،
// بعد به دانیار می‌گوید «این پروژه را بررسی کن» — این ابزار همان اولین قدم
// (Upload ZIP → استخراج) را انجام می‌دهد. قدم بعدی analyze_project است.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'unzip_project',
  description:
    'یک فایل ZIP که داخل workspace است را استخراج کن و یک پوشه‌ی پروژه بساز. ' +
    'بعد از این، حتماً با analyze_project ساختار و استک فنی پروژه‌ی استخراج‌شده را بررسی کن.',
  input_schema: {
    type: 'object',
    properties: {
      zipPath: { type: 'string', description: 'مسیر نسبی فایل ZIP داخل workspace (مثلاً "myapp.zip")' },
      projectName: { type: 'string', description: 'اسم پوشه‌ی مقصد داخل workspace/projects (اختیاری)' },
    },
    required: ['zipPath'],
  },
  permission: 'yellow',
  handler: async ({ zipPath, projectName }) => {
    try {
      const zipFull = safePath(zipPath);
      if (!fs.existsSync(zipFull)) return `خطا: فایل ZIP پیدا نشد: ${zipPath}`;

      const name = (projectName || path.basename(zipPath, '.zip')).replace(/[^\w\-.]/g, '_');
      const destRel = path.join('projects', name);
      const destFull = safePath(destRel);
      fs.mkdirSync(destFull, { recursive: true });

      const zip = new AdmZip(zipFull);
      zip.extractAllTo(destFull, true);
      const fileCount = zip.getEntries().filter((e) => !e.isDirectory).length;

      return `استخراج شد: ${fileCount} فایل در workspace/${destRel}\nحالا با analyze_project(projectFolder="${destRel}") ساختارش را بررسی کن.`;
    } catch (err) {
      return `خطا در استخراج ZIP: ${err.message}`;
    }
  },
};

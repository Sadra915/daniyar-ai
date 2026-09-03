// plugins/diff_files.js — بخش «Diff» از Code Editor داخلی سند اصلی، مستقل از git_local
// (اونجا فقط diff داخل یک مخزن git کار می‌کنه؛ این ابزار هر دو فایل دلخواه رو مقایسه می‌کنه،
// حتی اگه اصلاً git نباشه — مثلاً مقایسه‌ی یک فایل با نسخه‌ی قبلیش تو یک Snapshot).
const fs = require('fs');
const { execFile } = require('child_process');
const { safePath } = require('./_workspace-utils');

const TIMEOUT_MS = 15000;

module.exports = {
  name: 'diff_files',
  description:
    'دو فایل متنی داخل workspace را با هم مقایسه کن و تفاوت خط‌به‌خط (unified diff) را برگردان. ' +
    'برای مقایسه‌ی دو نسخه از یک فایل (مثلاً قبل/بعد از یک اصلاح، یا نسخه‌ی فعلی با یک Snapshot) استفاده کن — نیازی به git ندارد.',
  input_schema: {
    type: 'object',
    properties: {
      pathA: { type: 'string', description: 'مسیر نسبی فایل اول (نسخه‌ی قدیمی)' },
      pathB: { type: 'string', description: 'مسیر نسبی فایل دوم (نسخه‌ی جدید)' },
    },
    required: ['pathA', 'pathB'],
  },
  permission: 'green',
  handler: async ({ pathA, pathB }) => {
    const fullA = safePath(pathA);
    const fullB = safePath(pathB);
    if (!fs.existsSync(fullA)) return `خطا: فایل پیدا نشد: ${pathA}`;
    if (!fs.existsSync(fullB)) return `خطا: فایل پیدا نشد: ${pathB}`;

    return new Promise((resolve) => {
      execFile('diff', ['-u', '--label', pathA, '--label', pathB, fullA, fullB],
        { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          if (err && err.code === 1) {
            // exit code 1 یعنی «تفاوت پیدا شد» — این خطا نیست، نتیجه‌ی نرمال diff است
            resolve(stdout.slice(0, 6000) || '(بدون تفاوت)');
            return;
          }
          if (err && err.code !== 1) {
            resolve(`خطا در اجرای diff: ${err.message}`);
            return;
          }
          resolve(stdout.trim() || '(دو فایل کاملاً یکسان‌اند)');
        });
    });
  },
};

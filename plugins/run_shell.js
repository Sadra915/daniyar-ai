// plugins/run_shell.js — اجرای دستور شل، محدود به workspace با Timeout.
// این معادل ساده‌ی «Linux Workspace» و «Terminal» تو سند اصلیه.
// توجه: این Sandbox واقعی سطح Container نیست، فقط با cwd محدود و timeout
// جلوی خیلی از خطرات رو می‌گیره. برای Production واقعی باید تو یک
// Docker Container جدا (مثلاً gVisor/Firecracker) اجرا بشه.
const { execFile } = require('child_process');
const { WORKSPACE } = require('./_workspace-utils');

const TIMEOUT_MS = 20000;

module.exports = {
  name: 'run_shell',
  description: 'یک دستور شل را داخل workspace ایزوله اجرا کن (Timeout ۲۰ ثانیه). برای نصب پکیج، اجرای تست، build و غیره استفاده کن.',
  input_schema: {
    type: 'object',
    properties: { command: { type: 'string', description: 'دستور کامل شل، مثلاً "npm install" یا "python3 script.py"' } },
    required: ['command'],
  },
  permission: 'yellow',
  handler: async ({ command }) => {
    if (process.env.ALLOW_SHELL === 'false') {
      return 'اجرای شل توسط تنظیمات سرور غیرفعال شده (ALLOW_SHELL=false).';
    }
    return new Promise((resolve) => {
      execFile('bash', ['-c', command], { cwd: WORKSPACE, timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err && err.killed) {
            resolve(`خطا: دستور بیش از ${TIMEOUT_MS / 1000} ثانیه طول کشید و متوقف شد.`);
            return;
          }
          let out = '';
          if (stdout) out += `stdout:\n${stdout}\n`;
          if (stderr) out += `stderr:\n${stderr}\n`;
          if (err) out += `exit code: ${err.code}\n`;
          resolve(out || '(بدون خروجی، اجرا موفق بود)');
        });
    });
  },
};

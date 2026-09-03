// plugins/install_package.js — نصب یک پکیج npm در ریشه‌ی پروژه (نه workspace/).
// جدا از run_shell چون معناش صریح‌تره: مدل دقیق می‌دونه این کار فقط نصب وابستگیه.
const { execFile } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'install_package',
  description: 'یک پکیج npm را در پروژه‌ی دانیار نصب کن (وقتی کدی که می‌نویسی به یک کتابخانه‌ی جدید نیاز دارد).',
  input_schema: {
    type: 'object',
    properties: { packageName: { type: 'string' } },
    required: ['packageName'],
  },
  permission: 'yellow',
  handler: async ({ packageName }) => {
    if (!/^[a-zA-Z0-9@/_.\-]+$/.test(packageName)) {
      return 'خطا: نام پکیج نامعتبر است.';
    }
    return new Promise((resolve) => {
      execFile('npm', ['install', packageName], { cwd: ROOT, timeout: 60000, maxBuffer: 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) { resolve(`خطا در نصب: ${stderr || err.message}`); return; }
          resolve(`نصب شد: ${packageName}\n${stdout.slice(0, 1500)}`);
        });
    });
  },
};

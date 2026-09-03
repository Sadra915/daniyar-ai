// plugins/run_sandboxed.js — «امنیت و Sandbox» سند اصلی، نسخه‌ی واقعی با Docker
// (نه فقط cwd محدود مثل run_shell). محدودیت CPU/RAM/Process/Network واقعاً از
// طریق فلگ‌های docker اعمال می‌شه. اگه docker نصب نباشه یا تصویر ساخته نشده باشه،
// به‌جای fallback خاموش به run_shell (که گمراه‌کننده‌ست)، صادقانه می‌گه دقیقاً چی کم است.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { safePath } = require('./_workspace-utils');

const IMAGE_NAME = 'daniyar-sandbox';
const DOCKERFILE = path.join(__dirname, '..', 'docker', 'Dockerfile.sandbox');
const TIMEOUT_MS = 60000;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      resolve({ ok: !err, notFound: err?.code === 'ENOENT', killed: err?.killed || false, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

async function dockerAvailable() {
  const r = await run('docker', ['--version']);
  return !r.notFound;
}

async function imageExists() {
  const r = await run('docker', ['image', 'inspect', IMAGE_NAME]);
  return r.ok;
}

module.exports = {
  name: 'run_sandboxed',
  description:
    'یک دستور شل را داخل یک Docker Container واقعاً ایزوله اجرا کن (نه فقط cwd محدود مثل run_shell). ' +
    'محدودیت CPU/RAM/تعداد Process/شبکه واقعاً اعمال می‌شود. برای اجرای کد نامطمئن (مثلاً از یک ZIP آپلودشده‌ی ناشناس) ' +
    'به‌جای run_shell از این استفاده کن. نیاز به نصب Docker روی سیستم دارد؛ اگر نصب نباشد صریح اعلام می‌کند.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'دستور کامل شل برای اجرا داخل Container' },
      projectFolder: { type: 'string', description: 'پوشه‌ی پروژه داخل workspace که به /workspace داخل Container map می‌شود' },
      network: { type: 'string', enum: ['disabled', 'allowed'], description: 'پیش‌فرض disabled (🟢 امن‌تر)' },
      memoryLimit: { type: 'string', description: 'مثلاً "256m" یا "1g"، پیش‌فرض 512m' },
    },
    required: ['command', 'projectFolder'],
  },
  permission: 'yellow',
  handler: async ({ command, projectFolder, network = 'disabled', memoryLimit = '512m' }) => {
    if (!(await dockerAvailable())) {
      return 'Docker روی این سیستم نصب/در دسترس نیست. برای فعال‌کردن Sandbox واقعی، Docker Desktop یا Docker Engine را نصب کن. ' +
        'تا آن موقع، run_shell همچنان کار می‌کند ولی بدون ایزولاسیون واقعی (فقط cwd محدود).';
    }

    if (!(await imageExists())) {
      if (!fs.existsSync(DOCKERFILE)) return `خطا: Dockerfile پیدا نشد: ${DOCKERFILE}`;
      const build = await run('docker', ['build', '-t', IMAGE_NAME, '-f', DOCKERFILE, path.dirname(DOCKERFILE)],
        { timeout: 300000, maxBuffer: 5 * 1024 * 1024 });
      if (!build.ok) {
        return `تصویر Sandbox (${IMAGE_NAME}) هنوز ساخته نشده و ساختش الان شکست خورد (احتمالاً به اینترنت نیاز دارد برای دانلود پکیج‌ها):\n${build.stderr.slice(0, 1500)}`;
      }
    }

    const dir = safePath(projectFolder);
    if (!fs.existsSync(dir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

    const args = [
      'run', '--rm',
      '--memory', memoryLimit,
      '--cpus', '1',
      '--pids-limit', '128',
      '-v', `${dir}:/workspace`,
      '-w', '/workspace',
    ];
    if (network === 'disabled') args.push('--network', 'none');
    args.push(IMAGE_NAME, 'bash', '-c', command);

    const result = await run('docker', args, { timeout: TIMEOUT_MS });
    const status = result.killed ? `⏱️ Timeout (${TIMEOUT_MS / 1000}s)` : result.ok ? '✅ موفق' : '❌ ناموفق';
    return `اجرا شد داخل Container (network: ${network}, memory: ${memoryLimit})\nوضعیت: ${status}\n\nstdout:\n${result.stdout.slice(0, 3000) || '(خالی)'}\n\nstderr:\n${result.stderr.slice(0, 1500) || '(خالی)'}`;
  },
};

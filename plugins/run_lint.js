// plugins/run_lint.js — بخش «Lint ⚠️ / Type Check ❌» از سند اصلی که run_build_test پوششش نمی‌داد.
// جدا از run_build_test چون معنای متفاوتی داره: تست می‌گه کد درست کار می‌کنه، لینت/تایپ‌چک
// می‌گه کد تمیز و بدون خطای نوع نوشته شده — دو مرحله‌ی جدا تو چرخه‌ی Build/Testing سند اصلی.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { safePath } = require('./_workspace-utils');

const TIMEOUT_MS = 45000;

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        killed: err?.killed || false,
        notFound: err?.code === 'ENOENT',
        stdout: (stdout || '').slice(0, 3000),
        stderr: (stderr || '').slice(0, 1500),
      });
    });
  });
}

module.exports = {
  name: 'run_lint',
  description:
    'Lint و/یا Type Check واقعی روی یک پروژه اجرا کن (نه فقط تست/بیلد). ' +
    'پشتیبانی: Node/TS (eslint اگر نصب باشد، tsc اگر tsconfig.json باشد)، Python (ruff یا flake8)، Rust (cargo clippy). ' +
    'اگر ابزار لینت نصب نباشد، همین را صریح گزارش می‌کند — وانمود نمی‌کند که چک شده.',
  input_schema: {
    type: 'object',
    properties: {
      projectFolder: { type: 'string' },
    },
    required: ['projectFolder'],
  },
  permission: 'yellow',
  handler: async ({ projectFolder }) => {
    const dir = safePath(projectFolder);
    if (!fs.existsSync(dir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

    const checks = [];

    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (allDeps.eslint) {
        const r = await run('npx', ['--no-install', 'eslint', '.'], dir);
        checks.push({ name: 'ESLint', ...r });
      } else {
        checks.push({ name: 'ESLint', skipped: 'در package.json نصب نیست' });
      }

      if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
        const r = await run('npx', ['--no-install', 'tsc', '--noEmit'], dir);
        checks.push({ name: 'TypeScript (tsc --noEmit)', ...r });
      }

      if (checks.length === 0 || checks.every((c) => c.skipped)) {
        checks.push({ name: 'General', skipped: 'نه eslint نصب است نه tsconfig.json موجود است' });
      }
    } else if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      let r = await run('ruff', ['check', '.'], dir);
      if (r.notFound) {
        r = await run('flake8', ['.'], dir);
        checks.push({ name: 'flake8', ...r });
      } else {
        checks.push({ name: 'ruff', ...r });
      }
    } else if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
      const r = await run('cargo', ['clippy', '--', '-D', 'warnings'], dir);
      checks.push({ name: 'cargo clippy', ...r });
    } else {
      return 'خطا: استک این پروژه تشخیص داده نشد (اول analyze_project را اجرا کن).';
    }

    const lines = checks.map((c) => {
      if (c.skipped) return `⏭️ ${c.name}: رد شد — ${c.skipped}`;
      if (c.notFound) return `⏭️ ${c.name}: ابزار روی سیستم نصب نیست`;
      if (c.killed) return `⏱️ ${c.name}: Timeout`;
      const status = c.ok ? '✅ تمیز' : '❌ خطا/هشدار دارد';
      return `${status} ${c.name}\n${(c.stdout || c.stderr || '').slice(0, 800)}`;
    });

    return lines.join('\n\n');
  },
};

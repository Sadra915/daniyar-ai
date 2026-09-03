// plugins/run_build_test.js — «Build و Testing» از سند اصلی، نسخه‌ی واقعی.
// بر اساس فایل‌های علامت‌گذار (مثل analyze_project) دستور مناسب رو حدس می‌زنه
// و واقعاً اجراش می‌کنه — به‌جای اینکه فقط بگه «کد آماده است».
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { safePath } = require('./_workspace-utils');

const TIMEOUT_MS = 60000;

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        killed: err?.killed || false,
        code: err?.code,
        stdout: (stdout || '').slice(0, 3000),
        stderr: (stderr || '').slice(0, 1500),
      });
    });
  });
}

module.exports = {
  name: 'run_build_test',
  description:
    'بعد از analyze_project، دستور تست/بیلد مناسبِ استک تشخیص‌داده‌شده را واقعاً اجرا کن و گزارش Pass/Fail واقعی بده ' +
    '(نه اینکه فرض کنی موفق بوده). پشتیبانی: Node.js (npm test/build)، Python (pytest)، Rust (cargo test)، Go (go test)، Java/Maven (mvn test).',
  input_schema: {
    type: 'object',
    properties: {
      projectFolder: { type: 'string' },
      target: { type: 'string', enum: ['test', 'build'], description: 'پیش‌فرض test' },
    },
    required: ['projectFolder'],
  },
  permission: 'yellow',
  handler: async ({ projectFolder, target = 'test' }) => {
    const dir = safePath(projectFolder);
    if (!fs.existsSync(dir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

    let result;
    let ranCommand;

    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (!pkg.scripts?.[target]) {
        return `خطا: در package.json اسکریپت "${target}" تعریف نشده (اسکریپت‌های موجود: ${Object.keys(pkg.scripts || {}).join(', ') || '(هیچ‌کدام)'}).`;
      }
      ranCommand = `npm run ${target}`;
      result = await run('npm', ['run', target], dir);
    } else if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      ranCommand = 'pytest';
      result = await run('pytest', [], dir);
    } else if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
      ranCommand = target === 'build' ? 'cargo build' : 'cargo test';
      result = await run('cargo', [target === 'build' ? 'build' : 'test'], dir);
    } else if (fs.existsSync(path.join(dir, 'go.mod'))) {
      ranCommand = 'go test ./...';
      result = await run('go', ['test', './...'], dir);
    } else if (fs.existsSync(path.join(dir, 'pom.xml'))) {
      ranCommand = `mvn ${target}`;
      result = await run('mvn', [target], dir);
    } else {
      return 'خطا: استک این پروژه تشخیص داده نشد (اول analyze_project را اجرا کن) یا فایل تنظیمات شناخته‌شده‌ای ندارد.';
    }

    const status = result.killed
      ? `⏱️ Timeout (بیش از ${TIMEOUT_MS / 1000} ثانیه)`
      : result.ok
        ? '✅ موفق'
        : `❌ ناموفق (exit code: ${result.code})`;

    return `دستور اجراشده: ${ranCommand}\nوضعیت: ${status}\n\nstdout:\n${result.stdout || '(خالی)'}\n\nstderr:\n${result.stderr || '(خالی)'}`;
  },
};

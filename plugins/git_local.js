// plugins/git_local.js — بخش «Git و Repository» سند اصلی، نسخه‌ی واقعی و ساختاریافته
// (نه فقط از طریق run_shell دستور خام زدن). هر action دقیقاً یک عملیات git شناخته‌شده است،
// خروجی تمیزتر از run_shell خام برمی‌گردونه و برای عملیات نوشتنی (commit/checkout) permission
// جداگانه‌ای داره. push و pull_request حالا واقعی‌اند — از توکنی که github_auth.js
// با OAuth Device Flow گرفته استفاده می‌کنن؛ اگه هنوز وصل نشده باشه، صریح می‌گه.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { safePath } = require('./_workspace-utils');
const { loadToken } = require('./_github-auth-utils');

const TIMEOUT_MS = 30000;

function git(args, cwd, env) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim(), code: err?.code });
    });
  });
}

function requireAuth() {
  const token = loadToken();
  if (!token || token.status !== 'authorized') {
    return { ok: false, msg: 'وصل نیستی به GitHub. اول github_auth با action=start را اجرا کن و مراحل را تمام کن.' };
  }
  return { ok: true, token: token.access_token };
}

module.exports = {
  name: 'git_local',
  description:
    'عملیات Git واقعی روی یک پوشه‌ی پروژه داخل workspace: init، status، add (فایل یا "." برای همه)، ' +
    'commit (نیاز به message)، log، diff، branch (لیست یا ساخت با name)، checkout (به name نیاز دارد)، ' +
    'clone (از یک URL عمومی به projectFolder)، pull، push (نیاز به اتصال قبلی با github_auth)، ' +
    'pull_request (نیاز به owner/repo/base/head/title، نیاز به اتصال قبلی با github_auth).',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'status', 'add', 'commit', 'log', 'diff', 'branch', 'checkout', 'clone', 'pull', 'push', 'pull_request'],
      },
      projectFolder: { type: 'string', description: 'مسیر نسبی پوشه‌ی پروژه داخل workspace' },
      message: { type: 'string', description: 'فقط برای commit' },
      file: { type: 'string', description: 'فقط برای add، پیش‌فرض "."' },
      name: { type: 'string', description: 'اسم شاخه، فقط برای branch (ساخت) و checkout' },
      url: { type: 'string', description: 'فقط برای clone — آدرس عمومی ریپو' },
      remote: { type: 'string', description: 'فقط برای push، پیش‌فرض "origin"' },
      branch: { type: 'string', description: 'فقط برای push، پیش‌فرض شاخه‌ی فعلی' },
      owner: { type: 'string', description: 'فقط برای pull_request — صاحب ریپو' },
      repo: { type: 'string', description: 'فقط برای pull_request — اسم ریپو' },
      base: { type: 'string', description: 'فقط برای pull_request — شاخه‌ی مقصد (مثلاً main)' },
      head: { type: 'string', description: 'فقط برای pull_request — شاخه‌ی مبدأ' },
      title: { type: 'string', description: 'فقط برای pull_request' },
    },
    required: ['action', 'projectFolder'],
  },
  permission: 'red',
  handler: async ({ action, projectFolder, message, file, name, url, remote = 'origin', branch, owner, repo, base, head, title }) => {
    const dir = safePath(projectFolder);

    if (action === 'clone') {
      if (!url) return 'خطا: برای clone باید url داده شود.';
      if (fs.existsSync(dir)) return `خطا: پوشه از قبل وجود دارد: workspace/${projectFolder}`;
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      const r = await git(['clone', url, dir], path.dirname(dir));
      return r.ok
        ? `Clone شد: ${url} → workspace/${projectFolder}\n${r.stdout || r.stderr}`
        : `خطا در Clone: ${r.stderr || r.stdout}`;
    }

    if (!fs.existsSync(dir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

    if (action === 'init') {
      const r = await git(['init'], dir);
      return r.ok ? `مخزن Git ساخته شد در workspace/${projectFolder}` : `خطا: ${r.stderr}`;
    }

    if (action === 'status') {
      const r = await git(['status', '--short', '--branch'], dir);
      return r.ok ? (r.stdout || '(بدون تغییر)') : `خطا: ${r.stderr}`;
    }

    if (action === 'add') {
      const r = await git(['add', file || '.'], dir);
      return r.ok ? `اضافه شد به staging: ${file || '.'}` : `خطا: ${r.stderr}`;
    }

    if (action === 'commit') {
      if (!message) return 'خطا: برای commit باید message داده شود.';
      const r = await git(['commit', '-m', message], dir);
      return r.ok ? r.stdout : `خطا در commit: ${r.stderr || r.stdout}`;
    }

    if (action === 'log') {
      const r = await git(['log', '--oneline', '-20'], dir);
      return r.ok ? (r.stdout || '(هنوز هیچ commitی نیست)') : `خطا: ${r.stderr}`;
    }

    if (action === 'diff') {
      const r = await git(['diff'], dir);
      return r.ok ? (r.stdout || '(بدون تفاوت — working tree تمیز است)').slice(0, 4000) : `خطا: ${r.stderr}`;
    }

    if (action === 'branch') {
      if (name) {
        const r = await git(['branch', name], dir);
        return r.ok ? `شاخه‌ی جدید ساخته شد: ${name}` : `خطا: ${r.stderr}`;
      }
      const r = await git(['branch', '--list'], dir);
      return r.ok ? r.stdout : `خطا: ${r.stderr}`;
    }

    if (action === 'checkout') {
      if (!name) return 'خطا: برای checkout باید name داده شود.';
      const r = await git(['checkout', name], dir);
      return r.ok ? r.stdout || `به شاخه‌ی "${name}" رفتی` : `خطا: ${r.stderr}`;
    }

    if (action === 'pull') {
      const r = await git(['pull'], dir);
      return r.ok ? r.stdout : `خطا در pull: ${r.stderr || r.stdout}`;
    }

    if (action === 'push') {
      const auth = requireAuth();
      if (!auth.ok) return auth.msg;

      const remoteUrlRes = await git(['remote', 'get-url', remote], dir);
      if (!remoteUrlRes.ok) return `خطا: remote "${remote}" پیدا نشد.`;

      // توکن رو موقتاً تو URL می‌ذاریم فقط برای همین push، جایی ذخیره نمی‌شه
      const authedUrl = remoteUrlRes.stdout.replace('https://', `https://x-access-token:${auth.token}@`);
      let currentBranch = branch;
      if (!currentBranch) {
        const b = await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
        currentBranch = b.stdout;
      }

      const r = await git(['push', authedUrl, currentBranch], dir);
      return r.ok || r.stderr.includes('->')
        ? `Push شد: ${currentBranch} → ${remote}\n${r.stderr || r.stdout}`
        : `خطا در push: ${r.stderr || r.stdout}`;
    }

    if (action === 'pull_request') {
      const auth = requireAuth();
      if (!auth.ok) return auth.msg;
      if (!owner || !repo || !base || !head || !title) {
        return 'خطا: برای pull_request باید owner، repo، base، head و title داده شود.';
      }
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'DaniyarAI',
          },
          body: JSON.stringify({ title, head, base }),
        });
        const data = await res.json();
        if (!res.ok) return `خطا در ساخت PR: ${data.message || res.status}`;
        return `PR ساخته شد: #${data.number} — ${data.html_url}`;
      } catch (err) {
        return `خطا در ساخت PR: ${err.message}`;
      }
    }

    return 'خطا: action نامعتبر است.';
  },
};


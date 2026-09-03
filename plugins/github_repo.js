// plugins/github_repo.js — بخش «GitHub» از سند اصلی، نسخه‌ی واقعی و read-only.
// OAuth کامل (که سند بهش اشاره کرده) پیاده نشده چون نیاز به ثبت یک OAuth App و
// redirect flow داره — ولی خواندن ریپوی عمومی نیازی به OAuth نداره، برای همین
// همین الان واقعاً کار می‌کنه. اگه GITHUB_TOKEN تو .env بذاری، محدودیت نرخ
// بالاتر می‌ره و به ریپوهای خصوصی هم دسترسی پیدا می‌کنی.
async function ghFetch(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'DaniyarAI' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API خطای ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

module.exports = {
  name: 'github_repo',
  description:
    'اطلاعات یک ریپوی GitHub را بخوان: اطلاعات کلی (info)، محتوای README (readme)، محتوای یک فایل خاص (file، به path نیاز دارد)، ' +
    'Issueهای باز (issues)، Pull Requestهای باز (pulls)، یا آخرین Commitها (commits). فقط خواندن — Push/Create پشتیبانی نمی‌شود.',
  input_schema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'صاحب ریپو، مثلاً "anthropics"' },
      repo: { type: 'string', description: 'اسم ریپو، مثلاً "claude-code"' },
      action: { type: 'string', enum: ['info', 'readme', 'file', 'issues', 'pulls', 'commits'] },
      path: { type: 'string', description: 'فقط برای action=file — مسیر فایل داخل ریپو' },
    },
    required: ['owner', 'repo', 'action'],
  },
  permission: 'green',
  handler: async ({ owner, repo, action, path: filePath }) => {
    try {
      const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

      if (action === 'info') {
        const d = await ghFetch(base);
        return `${d.full_name}\n${d.description || '(بدون توضیح)'}\n⭐ ${d.stargazers_count} | 🍴 ${d.forks_count} | زبان اصلی: ${d.language || '-'} | شاخه‌ی پیش‌فرض: ${d.default_branch}`;
      }

      if (action === 'readme') {
        const d = await ghFetch(`${base}/readme`);
        const text = Buffer.from(d.content, 'base64').toString('utf-8');
        return text.slice(0, 8000) + (text.length > 8000 ? '\n...[بریده شد]' : '');
      }

      if (action === 'file') {
        if (!filePath) return 'خطا: برای action=file باید path داده شود.';
        const d = await ghFetch(`${base}/contents/${filePath}`);
        if (Array.isArray(d)) return d.map((e) => (e.type === 'dir' ? `${e.name}/` : e.name)).join('\n');
        const text = Buffer.from(d.content, 'base64').toString('utf-8');
        return text.slice(0, 8000) + (text.length > 8000 ? '\n...[بریده شد]' : '');
      }

      if (action === 'issues') {
        const d = await ghFetch(`${base}/issues?state=open&per_page=10`);
        return d.map((i) => `#${i.number} ${i.title} (${i.comments} کامنت)`).join('\n') || '(هیچ Issue بازی نیست)';
      }

      if (action === 'pulls') {
        const d = await ghFetch(`${base}/pulls?state=open&per_page=10`);
        return d.map((p) => `#${p.number} ${p.title} — ${p.user.login}`).join('\n') || '(هیچ PR بازی نیست)';
      }

      if (action === 'commits') {
        const d = await ghFetch(`${base}/commits?per_page=10`);
        return d.map((c) => `${c.sha.slice(0, 7)} — ${c.commit.message.split('\n')[0]} (${c.commit.author.name})`).join('\n');
      }

      return 'خطا: action نامعتبر است.';
    } catch (err) {
      return `خطا در دسترسی به GitHub: ${err.message}`;
    }
  },
};

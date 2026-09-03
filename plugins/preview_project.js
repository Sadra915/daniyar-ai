// plugins/preview_project.js — بخش «Web Preview» سند اصلی. خود سرو کردن استاتیک
// در server.js اضافه شده (روت /preview/:name/...)؛ این پلاگین فقط چک می‌کنه که
// پروژه یک index.html داره یا نه و آدرس واقعی رو برمی‌گردونه — مدل نباید حدس بزنه.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'preview_project',
  description:
    'بررسی کن که یک پروژه‌ی داخل workspace/projects برای Web Preview آماده است (یعنی index.html در ریشه‌اش دارد) ' +
    'و در صورت آماده بودن، آدرس واقعی Preview را برگردان. این فقط فایل‌های استاتیک (HTML/CSS/JS) را سرو می‌کند؛ ' +
    'برای پروژه‌هایی که نیاز به سرور Backend (Node/Python) دارند، Web Preview کار نمی‌کند — باید با run_shell اجرا شوند.',
  input_schema: {
    type: 'object',
    properties: {
      projectFolder: { type: 'string', description: 'مثلاً projects/myapp' },
    },
    required: ['projectFolder'],
  },
  permission: 'green',
  handler: async ({ projectFolder }) => {
    const dir = safePath(projectFolder);
    if (!fs.existsSync(dir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

    const indexPath = path.join(dir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return `این پروژه index.html در ریشه ندارد، پس Web Preview (فقط استاتیک) برایش کار نمی‌کند. ` +
        `اگر یک پروژه‌ی Backend است (Node/Python/...)، باید با run_shell اجرا و پورتش را جداگانه باز کرد.`;
    }

    const name = path.basename(dir);
    // پروژه باید مستقیماً زیر workspace/projects باشد تا با روت /preview/:name سرو بشه
    const parent = path.basename(path.dirname(dir));
    if (parent !== 'projects') {
      return `خطا: Web Preview فقط برای پوشه‌های مستقیم زیر workspace/projects کار می‌کند (این پروژه: ${projectFolder}).`;
    }

    return `آماده است. آدرس Preview: http://localhost:3000/preview/${name}/`;
  },
};

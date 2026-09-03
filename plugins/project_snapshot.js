// plugins/project_snapshot.js — «Snapshot و Rollback» از سند اصلی، پیاده‌سازی واقعی
// با کپی کامل پوشه (نه نصفه‌نیمه) — قبل از یک تغییر مهم بساز، اگه نتیجه بد بود برگرد.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'project_snapshot',
  description:
    'قبل از یک تغییر مهم روی یک پروژه، یک Snapshot کامل از پوشه‌اش بگیر (action=create)، لیست Snapshotهای قبلی را ببین (action=list)، ' +
    'یا پروژه را به یک Snapshot قبلی برگردان (action=restore — این عملیات فایل‌های فعلی را بازنویسی می‌کند، با احتیاط استفاده کن).',
  input_schema: {
    type: 'object',
    properties: {
      projectFolder: { type: 'string', description: 'مسیر نسبی پوشه‌ی پروژه داخل workspace' },
      action: { type: 'string', enum: ['create', 'list', 'restore'] },
      snapshotId: { type: 'string', description: 'فقط برای action=restore' },
    },
    required: ['projectFolder', 'action'],
  },
  permission: 'yellow',
  handler: async ({ projectFolder, action, snapshotId }) => {
    try {
      const projectDir = safePath(projectFolder);
      if (!fs.existsSync(projectDir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

      const snapshotsDir = path.join(projectDir, '.snapshots');
      fs.mkdirSync(snapshotsDir, { recursive: true });

      if (action === 'create') {
        const id = new Date().toISOString().replace(/[:.]/g, '-');
        const dest = path.join(snapshotsDir, id);
        fs.cpSync(projectDir, dest, {
          recursive: true,
          filter: (src) => !src.includes(`${path.sep}.snapshots`),
        });
        return `Snapshot گرفته شد: ${id}`;
      }

      if (action === 'list') {
        if (!fs.existsSync(snapshotsDir)) return '(هنوز هیچ Snapshotی گرفته نشده)';
        const list = fs.readdirSync(snapshotsDir).sort().reverse();
        return list.length ? list.join('\n') : '(هنوز هیچ Snapshotی گرفته نشده)';
      }

      if (action === 'restore') {
        if (!snapshotId) return 'خطا: برای restore باید snapshotId داده شود (از action=list بگیرش).';
        const src = path.join(snapshotsDir, snapshotId);
        if (!fs.existsSync(src)) return `خطا: Snapshot پیدا نشد: ${snapshotId}`;

        // فایل‌های فعلی (به‌جز خود .snapshots) رو پاک می‌کنیم و از snapshot برمی‌گردونیم
        for (const entry of fs.readdirSync(projectDir)) {
          if (entry === '.snapshots') continue;
          fs.rmSync(path.join(projectDir, entry), { recursive: true, force: true });
        }
        fs.cpSync(src, projectDir, { recursive: true });
        return `پروژه به Snapshot «${snapshotId}» بازگردانده شد.`;
      }

      return 'خطا: action نامعتبر است.';
    } catch (err) {
      return `خطا در Snapshot: ${err.message}`;
    }
  },
};

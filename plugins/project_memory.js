const memoryManager = require('../memory-manager');

module.exports = {
  name: 'project_memory',
  description:
    'وضعیت یک پروژه را بخوان یا به‌روزرسانی کن (معماری، تصمیمات فنی، کارهای انجام‌شده/باقی‌مانده، مشکلات شناخته‌شده، وضعیت یک‌خطی فعلی). ' +
    'همیشه بعد از یک مرحله‌ی مهم روی یک پروژه، با action=update ثبتش کن تا اگر کاربر روز بعد برگشت، ادامه بدی.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'update'] },
      project: { type: 'string', description: 'نام پروژه (اگر خالی باشد، پروژه‌ی فعال فعلی استفاده می‌شود)' },
      patch: {
        type: 'object',
        description: 'فقط برای action=update — فیلدهایی که تغییر می‌کنند (architecture, state, completedTasks, pendingTasks, knownIssues, importantFiles)',
      },
    },
    required: ['action'],
  },
  permission: 'green',
  handler: async ({ action, project, patch }) => {
    const name = project || memoryManager.getSession().activeProject;
    if (!name) return 'خطا: نام پروژه داده نشده و هیچ پروژه‌ی فعالی هم نیست. اول با switch_project یک پروژه انتخاب/بساز.';
    if (action === 'read') {
      return JSON.stringify(memoryManager.getProjectMemory(name), null, 2);
    }
    if (action === 'update') {
      const updated = memoryManager.updateProjectMemory(name, patch || {});
      return `حافظه‌ی پروژه «${name}» به‌روزرسانی شد.\n${JSON.stringify(updated, null, 2)}`;
    }
    return 'خطا: action نامعتبر است (باید read یا update باشد).';
  },
};

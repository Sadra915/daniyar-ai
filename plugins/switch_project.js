// plugins/switch_project.js — مدیریت پروژه‌ی فعال (Session Memory).
// وقتی کاربر گفت "روی پروژه‌ی X کار می‌کنم" یا اسم یک پروژه رو آورد، از این استفاده کن
// تا حافظه‌ی همون پروژه به‌عنوان context خودکار در دسترس باشه.
const memoryManager = require('../memory-manager');

module.exports = {
  name: 'switch_project',
  description: 'یک پروژه را به‌عنوان «پروژه‌ی فعال» انتخاب کن (اگر وجود نداشت، می‌سازدش)، یا با project=null پروژه‌ی فعال را خالی کن.',
  input_schema: {
    type: 'object',
    properties: {
      project: { type: ['string', 'null'], description: 'نام پروژه، یا null برای خارج شدن از حالت پروژه‌ی فعال' },
    },
    required: ['project'],
  },
  permission: 'green',
  handler: async ({ project }) => {
    const session = memoryManager.setActiveProject(project || null);
    return session.activeProject
      ? `پروژه‌ی فعال روی «${session.activeProject}» تنظیم شد.`
      : 'هیچ پروژه‌ای فعال نیست.';
  },
};

const memoryManager = require('../memory-manager');

module.exports = {
  name: 'remember_fact',
  description: 'یک واقعیت کلی و همیشگی درباره‌ی کاربر ذخیره کن (علایق، ترجیحات، اطلاعات پایدار) — نه چیزی مخصوص یک پروژه‌ی خاص (برای آن از project_memory استفاده کن).',
  input_schema: {
    type: 'object',
    properties: { fact: { type: 'string' } },
    required: ['fact'],
  },
  permission: 'green',
  handler: async ({ fact }) => {
    const entry = memoryManager.addUserFact(fact);
    return `ذخیره شد: ${entry.text}`;
  },
};

// plugins/delegate_agent.js — بخش «Multi-Agent» سند اصلی، اینترفیس واقعی برای دانیار
// (خود دانیار) که یک زیرکار رو به یک Sub-Agent تخصصی بسپاره. runSubAgent با
// require تأخیری (داخل handler، نه بالای فایل) لود می‌شه تا وابستگی چرخشی با
// plugin-loader پیش نیاد (چون multi-agent.js خودش plugin-loader رو صدا می‌زنه).
module.exports = {
  name: 'delegate_agent',
  description:
    'یک زیرکار مشخص را به یک Sub-Agent تخصصی بسپار (نقش‌ها: backend، frontend، database، testing، security، devops، docs، architect). ' +
    'هر نقش فقط به ابزارهای مرتبط با کارش دسترسی دارد. توجه: این اجرا ترتیبی است، نه واقعاً موازی — ' +
    'برای کارهای بزرگ، آن را به چند delegate_agent جدا (هر کدام یک نقش) تقسیم کن و نتیجه‌ی هرکدام را قبل از بعدی ببین.',
  input_schema: {
    type: 'object',
    properties: {
      role: { type: 'string', enum: ['backend', 'frontend', 'database', 'testing', 'security', 'devops', 'docs', 'architect'] },
      task: { type: 'string', description: 'توضیح دقیق و مستقل از زمینه‌ی زیرکار (Sub-Agent تاریخچه‌ی گفتگوی اصلی را نمی‌بیند)' },
    },
    required: ['role', 'task'],
  },
  permission: 'yellow',
  handler: async ({ role, task }) => {
    const provider = process.env.AI_PROVIDER || 'openrouter';
    const { runSubAgent } = require('../multi-agent');
    const result = await runSubAgent({ provider, role, task });

    const stepsBlock = result.steps.length
      ? `\n\nابزارهایی که این Sub-Agent واقعاً استفاده کرد:\n${result.steps.map((s) => `- ${s}`).join('\n')}`
      : '\n\n(این Sub-Agent هیچ ابزاری صدا نزد، فقط پاسخ متنی داد)';

    return `[نتیجه‌ی ${role} Agent]\n${result.summary}${stepsBlock}`;
  },
};

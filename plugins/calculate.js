module.exports = {
  name: 'calculate',
  description: 'یک عبارت ریاضی ساده را محاسبه کن.',
  input_schema: {
    type: 'object',
    properties: { expression: { type: 'string' } },
    required: ['expression'],
  },
  permission: 'green',
  handler: async ({ expression }) => {
    if (!/^[0-9+\-*/().\s%^]+$/.test(expression)) {
      return 'خطا: عبارت شامل کاراکترهای غیرمجاز است.';
    }
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expression})`)();
      return `نتیجه: ${result}`;
    } catch (err) {
      return `خطا در محاسبه: ${err.message}`;
    }
  },
};

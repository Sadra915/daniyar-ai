// plugins/http_request.js — دسترسی وب عمومی (نه Search، فقط گرفتن محتوای یک URL/API مشخص).
module.exports = {
  name: 'http_request',
  description: 'محتوای یک URL یا پاسخ یک API عمومی را با GET یا POST بگیر. برای وقتی که آدرس دقیق منبع را می‌دانی؛ برای جست‌وجوی باز، این ابزار مناسب نیست (چون Search واقعی هنوز وصل نشده).',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      method: { type: 'string', enum: ['GET', 'POST'] },
      body: { type: 'string', description: 'فقط برای POST، به‌صورت متن یا JSON stringify شده' },
    },
    required: ['url'],
  },
  permission: 'yellow',
  handler: async ({ url, method = 'GET', body }) => {
    try {
      const res = await fetch(url, {
        method,
        body: method === 'POST' ? body : undefined,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      });
      const text = await res.text();
      return `status: ${res.status}\n${text.slice(0, 6000)}`;
    } catch (err) {
      return `خطا در درخواست: ${err.message}`;
    }
  },
};

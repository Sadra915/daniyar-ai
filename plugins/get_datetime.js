module.exports = {
  name: 'get_datetime',
  description: 'تاریخ و ساعت فعلی سیستم را بگیر.',
  input_schema: { type: 'object', properties: {} },
  permission: 'green',
  handler: async () => {
    const now = new Date();
    return `ISO: ${now.toISOString()}\nمحلی: ${now.toLocaleString('fa-IR')}`;
  },
};

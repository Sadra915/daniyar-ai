// plugins/web_search.js — جست‌وجوی واقعی وب، بدون نیاز به کلید API.
// این همون چیزیه که در persona.md به‌عنوان «نقشه‌ی راه» علامت خورده بود؛
// حالا واقعاً وصله. از DuckDuckGo HTML (نسخه‌ی lite) استفاده می‌کنه چون
// نه کلید لازم داره نه صورت‌حساب.
module.exports = {
  name: 'web_search',
  description:
    'جست‌وجوی واقعی در وب برای یک عبارت و برگرداندن چند نتیجه‌ی برتر (عنوان، لینک، خلاصه). ' +
    'برای سؤال‌های «باز» یا اطلاعات به‌روز که آدرس دقیق منبعش را نمی‌دانی از این استفاده کن؛ ' +
    'اگر آدرس دقیق را می‌دانی از http_request استفاده کن.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'عبارت جست‌وجو' },
    },
    required: ['query'],
  },
  permission: 'green',
  handler: async ({ query }) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (DaniyarAI)' } });
      const html = await res.text();

      const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
      const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      const results = [];
      let match;
      while ((match = re.exec(html)) && results.length < 5) {
        results.push({ title: strip(match[2]), url: match[1], snippet: strip(match[3]) });
      }

      if (results.length === 0) {
        return `جست‌وجو برای «${query}» انجام شد ولی نتیجه‌ای پارس نشد (ممکنه ساختار صفحه‌ی DuckDuckGo عوض شده باشه).`;
      }

      return results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
    } catch (err) {
      return `خطا در جست‌وجوی وب: ${err.message}`;
    }
  },
};

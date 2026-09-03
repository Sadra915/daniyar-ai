// plugin-loader.js
// هر فایل تو پوشه‌ی plugins/ که یک ابزار (tool) صادر کنه، خودکار شناسایی می‌شه.
// برای اضافه کردن قابلیت جدید، کافیه یک فایل جدید تو plugins/ بسازی —
// نیازی به دست‌زدن به server.js یا agent.js نیست.
//
// هر پلاگین باید این شکل رو export کنه:
// module.exports = {
//   name: 'tool_name',              // اسم یکتا برای ابزار
//   description: '...',             // توضیح برای مدل (که تصمیم بگیره کِی ازش استفاده کنه)
//   input_schema: { ... },          // JSON schema استاندارد Anthropic tool use
//   permission: 'green'|'yellow'|'red', // سطح حساسیت عملیات (برای تایید کاربر)
//   handler: async (input) => { ... return resultString }
// };

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, 'plugins');
const REGISTRY_PATH = path.join(__dirname, 'memory', 'plugin-registry.json');
function disabledPlugins(){ try { return JSON.parse(fs.readFileSync(REGISTRY_PATH,'utf8')).disabled || []; } catch { return []; } }

function loadPlugins() {
  const disabled = new Set(disabledPlugins());
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  const tools = [];
  const handlers = {};
  const failed = [];

  for (const file of files) {
    let mod;
    try {
      mod = require(path.join(PLUGINS_DIR, file));
    } catch (err) {
      // یک پلاگین خراب (مثلاً وابستگی npm نصب‌نشده) نباید کل سیستم ابزارها رو
      // از کار بندازه — فقط همون یکی رد می‌شه و بقیه عادی کار می‌کنن.
      failed.push({ file, error: err.message });
      console.warn(`[plugin-loader] بارگذاری نشد: ${file} — ${err.message}`);
      continue;
    }
    if (!mod.name || !mod.handler) {
      console.warn(`[plugin-loader] رد شد: ${file} — فرمت نامعتبر`);
      continue;
    }
    if (disabled.has(mod.name)) continue;
    tools.push({
      name: mod.name,
      description: mod.description || '',
      input_schema: mod.input_schema || { type: 'object', properties: {} },
      permission: mod.permission || 'green',
      category: mod.category || 'عمومی',
      icon: mod.icon || '✦',
      version: mod.version || '1.0.0',
    });
    handlers[mod.name] = {
      handler: mod.handler,
      permission: mod.permission || 'green',
    };
  }

  return { tools, handlers, failed };
}

module.exports = { loadPlugins };

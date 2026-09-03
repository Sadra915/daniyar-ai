// plugins/apk_analyzer.js — بخش «APK Analyzer» سند اصلی، نسخه‌ی واقعی.
// APK یک فایل ZIP با یک AndroidManifest.xml باینری خاصه که خواندنش با unzip معمولی
// جواب نمی‌ده — برای همین از app-info-parser استفاده می‌کنیم که فرمت باینری
// Android رو واقعاً می‌فهمه (باید در package.json اضافه بشه و npm install بشه).
const fs = require('fs');
const { safePath } = require('./_workspace-utils');

function loadParser() {
  try {
    return require('app-info-parser');
  } catch {
    return null;
  }
}

module.exports = {
  name: 'apk_analyzer',
  description:
    'یک فایل APK داخل workspace را واقعاً تحلیل کن: Package Name، Version (name/code)، ' +
    'Permissions، Activities، Services، min/target SDK — از AndroidManifest.xml باینری داخل APK. ' +
    'اجرای کد داخل APK یا تحلیل امنیتی عمیق (مثل اسکن کد native) پشتیبانی نمی‌شود، فقط اطلاعات ساختاری Manifest.',
  input_schema: {
    type: 'object',
    properties: {
      apkPath: { type: 'string', description: 'مسیر نسبی فایل .apk داخل workspace' },
    },
    required: ['apkPath'],
  },
  permission: 'green',
  handler: async ({ apkPath }) => {
    const AppInfoParser = loadParser();
    if (!AppInfoParser) {
      return 'تحلیل APK در این محیط فعال نیست چون parser باینری Android Manifest به native/سازگاری محیط نیاز دارد. فایل را می‌توانی در Workspace نگه داری؛ این ابزار بدون parser وانمود به تحلیل نمی‌کند.';
    }

    const full = safePath(apkPath);
    if (!fs.existsSync(full)) return `خطا: فایل پیدا نشد: ${apkPath}`;

    try {
      const parser = new AppInfoParser(full);
      const result = await parser.parse();
      const manifest = result.manifest || {};

      const usesPermissions = (manifest.usesPermissions || [])
        .map((p) => p?.name?.value || p?.name)
        .filter(Boolean);
      const activities = (manifest.application?.activity || [])
        .map((a) => a?.name?.value || a?.name)
        .filter(Boolean);
      const services = (manifest.application?.service || [])
        .map((s) => s?.name?.value || s?.name)
        .filter(Boolean);

      const lines = [
        `Package: ${manifest.package || '-'}`,
        `Version: ${manifest.versionName || '-'} (code: ${manifest.versionCode || '-'})`,
        `App Name: ${result.application?.label || '-'}`,
        `Min SDK: ${manifest.usesSdk?.minSdkVersion || '-'} | Target SDK: ${manifest.usesSdk?.targetSdkVersion || '-'}`,
        `Permissions (${usesPermissions.length}): ${usesPermissions.slice(0, 30).join(', ') || '-'}`,
        `Activities (${activities.length}): ${activities.slice(0, 15).join(', ') || '-'}`,
        `Services (${services.length}): ${services.slice(0, 15).join(', ') || '-'}`,
      ];
      return lines.join('\n');
    } catch (err) {
      return `خطا در تحلیل APK: ${err.message}`;
    }
  },
};

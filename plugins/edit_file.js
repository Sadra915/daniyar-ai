// plugins/edit_file.js — ویرایش دقیق یک فایل موجود با find/replace، به‌جای بازنویسی کامل.
// write_file برای فایل بزرگ گرون و پرخطاست (باید کل محتوا رو دوباره بفرسته).
// این ابزار دقیقاً مثل یک Diff کوچیک عمل می‌کنه: هر ویرایش باید در متن فایل
// دقیقاً یک‌بار پیدا بشه، وگرنه رد می‌شه (برای جلوگیری از تغییر جای اشتباه).
const fs = require('fs');
const { safePath } = require('./_workspace-utils');

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

module.exports = {
  name: 'edit_file',
  description:
    'یک فایل موجود در workspace را با یک یا چند ویرایش find/replace اصلاح کن (بدون بازنویسی کل فایل). ' +
    'هر old_str باید دقیقاً یک‌بار در فایل پیدا شود؛ اگر صفر یا چند بار پیدا شد، آن ویرایش رد می‌شود و خطا برمی‌گردد. ' +
    'برای حذف یک تکه کد، new_str را خالی بگذار. برای فایل جدید یا بازنویسی کامل از write_file استفاده کن.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'مسیر نسبی فایل داخل workspace' },
      edits: {
        type: 'array',
        description: 'لیست ویرایش‌ها، به‌ترتیب روی محتوای فایل اعمال می‌شوند',
        items: {
          type: 'object',
          properties: {
            old_str: { type: 'string', description: 'متن دقیق موجود در فایل (باید یکتا باشد)' },
            new_str: { type: 'string', description: 'متن جایگزین (خالی = حذف)' },
          },
          required: ['old_str'],
        },
      },
    },
    required: ['path', 'edits'],
  },
  permission: 'yellow',
  handler: async ({ path: relPath, edits }) => {
    const full = safePath(relPath);
    if (!fs.existsSync(full)) return `خطا: فایل پیدا نشد: ${relPath} (برای فایل جدید از write_file استفاده کن)`;
    if (!Array.isArray(edits) || edits.length === 0) return 'خطا: حداقل یک ویرایش لازم است.';

    let content = fs.readFileSync(full, 'utf8');
    const log = [];

    for (let i = 0; i < edits.length; i++) {
      const { old_str, new_str = '' } = edits[i];
      if (!old_str) {
        return `خطا: ویرایش شماره ${i + 1} فاقد old_str است.`;
      }
      const occurrences = countOccurrences(content, old_str);
      if (occurrences === 0) {
        return `خطا: ویرایش شماره ${i + 1} انجام نشد — متن مورد نظر در فایل پیدا نشد.\n(${edits.length === 1 ? '' : 'ویرایش‌های قبلی اعمال نشدند تا فایل ناقص نماند.'})`;
      }
      if (occurrences > 1) {
        return `خطا: ویرایش شماره ${i + 1} انجام نشد — متن مورد نظر ${occurrences} بار در فایل تکرار شده (باید یکتا باشد، متن بیشتری برای یکتا کردنش اضافه کن).`;
      }
      content = content.replace(old_str, new_str);
      log.push(`ویرایش ${i + 1}: ✅ (${old_str.length} → ${new_str.length} کاراکتر)`);
    }

    fs.writeFileSync(full, content, 'utf8');
    return `فایل ویرایش شد: ${relPath}\n${log.join('\n')}\nحجم نهایی: ${content.length} بایت`;
  },
};

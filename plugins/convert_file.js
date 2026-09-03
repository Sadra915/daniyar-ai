// plugins/convert_file.js — بخش «File Converter» سند اصلی، ولی فقط تبدیل‌هایی که با پکیج‌های
// از قبل نصب‌شده (mammoth، xlsx، pdf-parse) واقعاً و همین الان کار می‌کنن:
// docx→text/html، pdf→text، xlsx↔csv. تبدیل‌هایی مثل docx→pdf یا png→webp نیاز به
// موتور رندر/پردازش تصویر دارن که در این پروژه نصب نیست — عمداً پیاده نشدن،
// نه اینکه شبیه‌سازی بشن. فرق این با read_document: اون فقط متن رو نشون می‌ده،
// این یکی خروجی رو به‌عنوان یک فایل جدید در workspace ذخیره می‌کنه.
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { safePath } = require('./_workspace-utils');

const SUPPORTED = ['docx-to-text', 'docx-to-html', 'pdf-to-text', 'xlsx-to-csv', 'csv-to-xlsx'];

module.exports = {
  name: 'convert_file',
  description:
    `یک فایل را به فرمت دیگر تبدیل کن و به‌عنوان فایل جدید در workspace ذخیره کن. ` +
    `تبدیل‌های پشتیبانی‌شده: ${SUPPORTED.join('، ')}. ` +
    `تبدیل‌هایی مثل docx→pdf، png→webp، svg→png پشتیبانی نمی‌شوند (نیاز به موتور رندر/پردازش تصویر دارند که نصب نیست).`,
  input_schema: {
    type: 'object',
    properties: {
      inputPath: { type: 'string', description: 'مسیر نسبی فایل ورودی داخل workspace' },
      outputPath: { type: 'string', description: 'مسیر نسبی فایل خروجی داخل workspace' },
      conversion: { type: 'string', enum: SUPPORTED },
    },
    required: ['inputPath', 'outputPath', 'conversion'],
  },
  permission: 'yellow',
  handler: async ({ inputPath, outputPath, conversion }) => {
    const inFull = safePath(inputPath);
    if (!fs.existsSync(inFull)) return `خطا: فایل ورودی پیدا نشد: ${inputPath}`;
    const outFull = safePath(outputPath);
    fs.mkdirSync(path.dirname(outFull), { recursive: true });

    try {
      if (conversion === 'docx-to-text') {
        const { value } = await mammoth.extractRawText({ path: inFull });
        fs.writeFileSync(outFull, value, 'utf8');
        return `تبدیل شد: ${inputPath} → ${outputPath} (${value.length} کاراکتر متن)`;
      }

      if (conversion === 'docx-to-html') {
        const { value } = await mammoth.convertToHtml({ path: inFull });
        fs.writeFileSync(outFull, value, 'utf8');
        return `تبدیل شد: ${inputPath} → ${outputPath} (${value.length} کاراکتر HTML)`;
      }

      if (conversion === 'pdf-to-text') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(fs.readFileSync(inFull));
        fs.writeFileSync(outFull, data.text, 'utf8');
        return `تبدیل شد: ${inputPath} → ${outputPath} (${data.numpages} صفحه، ${data.text.length} کاراکتر)`;
      }

      if (conversion === 'xlsx-to-csv') {
        const wb = XLSX.readFile(inFull);
        const firstSheet = wb.SheetNames[0];
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheet]);
        fs.writeFileSync(outFull, csv, 'utf8');
        return `تبدیل شد: ${inputPath} (شیت "${firstSheet}") → ${outputPath}`;
      }

      if (conversion === 'csv-to-xlsx') {
        const csv = fs.readFileSync(inFull, 'utf8');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(csv.split('\n').map((line) => line.split(',')));
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, outFull);
        return `تبدیل شد: ${inputPath} → ${outputPath}`;
      }

      return `خطا: تبدیل "${conversion}" پشتیبانی نمی‌شود. گزینه‌های موجود: ${SUPPORTED.join(', ')}`;
    } catch (err) {
      return `خطا در تبدیل: ${err.message}`;
    }
  },
};

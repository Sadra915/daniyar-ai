// plugins/read_document.js — تکمیل «کار با فایل‌ها» از سند اصلی برای فرمت‌های باینری واقعی.
// read_file فقط فایل متنی ساده می‌خونه؛ این یکی فایل‌های PDF/DOCX/XLSX واقعی رو
// پارس می‌کنه و متن/محتواشون رو استخراج می‌کنه.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'read_document',
  description:
    'محتوای یک فایل PDF، Word (.docx) یا Excel (.xlsx/.xls) داخل workspace را استخراج کن. ' +
    'برای فایل‌های متنی ساده (txt/md/json/csv/کد) به‌جای این از read_file استفاده کن.',
  input_schema: {
    type: 'object',
    properties: { filePath: { type: 'string' } },
    required: ['filePath'],
  },
  permission: 'green',
  handler: async ({ filePath }) => {
    try {
      const full = safePath(filePath);
      if (!fs.existsSync(full)) return `خطا: فایل پیدا نشد: ${filePath}`;
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.pdf') {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(full);
        const data = await pdfParse(buffer);
        const text = data.text.trim();
        return `PDF — ${data.numpages} صفحه\n\n${text.slice(0, 15000)}${text.length > 15000 ? '\n...[بریده شد]' : ''}`;
      }

      if (ext === '.docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: full });
        const text = result.value.trim();
        return text.slice(0, 15000) + (text.length > 15000 ? '\n...[بریده شد]' : '');
      }

      if (ext === '.xlsx' || ext === '.xls') {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(full);
        const parts = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          return `## شیت: ${sheetName}\n${csv.slice(0, 4000)}`;
        });
        return parts.join('\n\n');
      }

      return `خطا: فرمت "${ext}" توسط read_document پشتیبانی نمی‌شود (فقط pdf/docx/xlsx/xls). برای فایل متنی از read_file استفاده کن.`;
    } catch (err) {
      return `خطا در خواندن سند: ${err.message}`;
    }
  },
};

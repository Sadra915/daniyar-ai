// plugins/convert_data.js — نسخه‌ی حداقلی «File Converter» و «Data Lab» از سند اصلی،
// فقط برای JSON↔CSV. برای فرمت‌های دیگه (DOCX/PDF/XLSX واقعی) باید کتابخانه‌های
// سنگین‌تر اضافه بشن — این‌جا صادقانه به همین دو فرمت محدود مونده.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

module.exports = {
  name: 'convert_data',
  description: 'یک فایل داده داخل workspace را بین فرمت JSON و CSV تبدیل کن.',
  input_schema: {
    type: 'object',
    properties: {
      inputPath: { type: 'string' },
      outputPath: { type: 'string' },
      direction: { type: 'string', enum: ['json2csv', 'csv2json'] },
    },
    required: ['inputPath', 'outputPath', 'direction'],
  },
  permission: 'yellow',
  handler: async ({ inputPath, outputPath, direction }) => {
    try {
      const inFull = safePath(inputPath);
      const outFull = safePath(outputPath);
      if (!fs.existsSync(inFull)) return `خطا: فایل ورودی پیدا نشد: ${inputPath}`;
      const raw = fs.readFileSync(inFull, 'utf8');

      if (direction === 'json2csv') {
        const data = JSON.parse(raw);
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length === 0) return 'خطا: داده‌ی JSON خالی است.';
        const headers = Object.keys(rows[0]);
        const lines = [headers.join(',')];
        for (const row of rows) lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
        fs.mkdirSync(path.dirname(outFull), { recursive: true });
        fs.writeFileSync(outFull, lines.join('\n'), 'utf8');
      } else if (direction === 'csv2json') {
        const lines = raw.trim().split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i]?.trim(); });
          return obj;
        });
        fs.mkdirSync(path.dirname(outFull), { recursive: true });
        fs.writeFileSync(outFull, JSON.stringify(rows, null, 2), 'utf8');
      } else {
        return 'خطا: direction باید json2csv یا csv2json باشد.';
      }

      return `تبدیل شد: ${inputPath} → ${outputPath}`;
    } catch (err) {
      return `خطا در تبدیل: ${err.message}`;
    }
  },
};

// plugins/generate_chart.js — بخش «نمودار بسازد» از Data Lab + «📈 داده → Chart» از Generative UI،
// یک SVG واقعی تولید می‌کنه (نه توضیح متنی جای نمودار) — بدون هیچ وابستگی خارجی،
// چون SVG یک فرمت متنی ساده‌ست و نیازی به کتابخانه‌ی رندر تصویر نداره.
// خروجی یک فایل .svg واقعی در workspace ذخیره می‌شه که هم قابل باز کردن تو مرورگره،
// هم می‌شه مستقیم تو HTML/README جاسازیش کرد.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

const WIDTH = 640;
const HEIGHT = 360;
const PAD = { top: 30, right: 20, bottom: 50, left: 50 };
const PALETTE = ['#e0a94e', '#4e8fe0', '#6ee08e', '#e04e6e', '#a94ee0'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  name: 'generate_chart',
  description:
    'یک نمودار میله‌ای (bar)، خطی (line)، دایره‌ای (pie) یا پراکندگی (scatter) واقعی به‌شکل SVG از داده‌های عددی بساز و در workspace ذخیره کن. ' +
    'برای بررسی سریع یک دیتاست (مثلاً بعد از analyze_data)، نمایش وضعیت یک پروژه یا مقایسه‌ی چند مقدار استفاده کن. ' +
    'بعد از ساختن، برای دیدنش داخل خود پاسخ حتماً با سینتکس ![توضیح](outputPath) بهش اشاره کن. ' +
    'برای رسم یک معادله/تابع ریاضی (مثل sin(x)) به‌جای این از plot_function استفاده کن.',
  input_schema: {
    type: 'object',
    properties: {
      style: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'] },
      labels: { type: 'array', items: { type: 'string' }, description: 'برچسب محور افقی یا اسلایس‌های pie' },
      values: { type: 'array', items: { type: 'number' }, description: 'مقادیر عددی، هم‌طول labels (برای scatter همون y)' },
      xValues: { type: 'array', items: { type: 'number' }, description: 'فقط برای style=scatter — مقادیر محور x، هم‌طول values' },
      title: { type: 'string' },
      outputPath: { type: 'string', description: 'مسیر نسبی فایل خروجی .svg داخل workspace' },
    },
    required: ['style', 'labels', 'values', 'outputPath'],
  },
  permission: 'green',
  handler: async ({ style, labels, values, xValues, title, outputPath }) => {
    if (!Array.isArray(labels) || !Array.isArray(values) || labels.length === 0 || labels.length !== values.length) {
      return 'خطا: labels و values باید آرایه باشند و طول یکسان داشته باشند.';
    }
    if (values.length > 50) return 'خطا: حداکثر ۵۰ نقطه‌ی داده پشتیبانی می‌شود.';

    if (style === 'pie') return renderPie({ labels, values, title, outputPath });

    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const color = PALETTE[0];

    const yOf = (v) => PAD.top + plotH - ((v - min) / range) * plotH;
    const xStep = plotW / values.length;

    let body = '';

    body += `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${HEIGHT - PAD.bottom}" stroke="#888" />`;
    body += `<line x1="${PAD.left}" y1="${HEIGHT - PAD.bottom}" x2="${WIDTH - PAD.right}" y2="${HEIGHT - PAD.bottom}" stroke="#888" />`;

    if (style === 'bar') {
      const barW = xStep * 0.6;
      values.forEach((v, i) => {
        const x = PAD.left + i * xStep + (xStep - barW) / 2;
        const y = yOf(Math.max(v, 0));
        const h = Math.abs(yOf(v) - yOf(0));
        body += `<rect x="${x.toFixed(1)}" y="${Math.min(y, yOf(0)).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" />`;
      });
    } else if (style === 'scatter') {
      const xs = Array.isArray(xValues) && xValues.length === values.length ? xValues : values.map((_, i) => i);
      const xMin = Math.min(...xs), xMax = Math.max(...xs);
      const xRange = (xMax - xMin) || 1;
      const xOf = (x) => PAD.left + ((x - xMin) / xRange) * plotW;
      values.forEach((v, i) => {
        body += `<circle cx="${xOf(xs[i]).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="4" fill="${color}" fill-opacity="0.85" />`;
      });
    } else {
      const points = values.map((v, i) => `${(PAD.left + i * xStep + xStep / 2).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
      body += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" />`;
      values.forEach((v, i) => {
        const x = PAD.left + i * xStep + xStep / 2;
        body += `<circle cx="${x.toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="3" fill="${color}" />`;
      });
    }

    labels.forEach((lbl, i) => {
      const x = PAD.left + i * xStep + xStep / 2;
      body += `<text x="${x.toFixed(1)}" y="${HEIGHT - PAD.bottom + 18}" font-size="11" fill="#ccc" text-anchor="middle">${esc(lbl).slice(0, 10)}</text>`;
    });

    body += `<text x="${PAD.left - 8}" y="${(PAD.top + 4).toFixed(1)}" font-size="10" fill="#ccc" text-anchor="end">${max}</text>`;
    body += `<text x="${PAD.left - 8}" y="${(HEIGHT - PAD.bottom).toFixed(1)}" font-size="10" fill="#ccc" text-anchor="end">${min}</text>`;

    const titleEl = title ? `<text x="${WIDTH / 2}" y="18" font-size="14" fill="#eee" text-anchor="middle" font-weight="bold">${esc(title)}</text>` : '';

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
      `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0c0f14" />` +
      titleEl + body +
      `</svg>`;

    const full = safePath(outputPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, svg, 'utf8');

    const styleFa = { bar: 'میله‌ای', line: 'خطی', scatter: 'پراکندگی' }[style] || style;
    return `نمودار ${styleFa} ساخته شد: ${outputPath} (${values.length} نقطه‌ی داده، بازه ${min} تا ${max})`;
  },
};

// نمودار دایره‌ای — هندسه‌اش کاملاً فرق داره (زاویه به‌جای محور x/y)، جدا نگه داشته شده
function renderPie({ labels, values, title, outputPath }) {
  const total = values.reduce((a, b) => a + Math.max(b, 0), 0);
  if (total <= 0) return 'خطا: مجموع مقادیر باید بزرگ‌تر از صفر باشد.';

  const cx = WIDTH / 2 - 60, cy = HEIGHT / 2 + 6, r = Math.min(HEIGHT, WIDTH) / 2 - 70;
  let angle = -Math.PI / 2;
  let body = '';
  let legend = '';

  values.forEach((v, i) => {
    const frac = Math.max(v, 0) / total;
    const nextAngle = angle + frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(nextAngle), y2 = cy + r * Math.sin(nextAngle);
    const largeArc = frac > 0.5 ? 1 : 0;
    const color = PALETTE[i % PALETTE.length];
    body += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${color}" stroke="#0c0f14" stroke-width="1.5" />`;
    const ly = 40 + i * 18;
    legend += `<rect x="${WIDTH - 140}" y="${ly - 9}" width="10" height="10" fill="${color}" />`;
    legend += `<text x="${WIDTH - 126}" y="${ly}" font-size="11" fill="#ccc">${esc(String(labels[i]).slice(0, 16))} (${(frac * 100).toFixed(0)}%)</text>`;
    angle = nextAngle;
  });

  const titleEl = title ? `<text x="${WIDTH / 2}" y="18" font-size="14" fill="#eee" text-anchor="middle" font-weight="bold">${esc(title)}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0c0f14" />` + titleEl + body + legend + `</svg>`;

  const full = safePath(outputPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, svg, 'utf8');
  return `نمودار دایره‌ای ساخته شد: ${outputPath} (${values.length} بخش)`;
}

// plugins/plot_function.js — رسم معادلات/توابع ریاضی (سند اصلی: «نمودارهای متفاوت برای
// معادلات و استدلال‌ها»). برخلاف generate_chart که روی داده‌ی آماده کار می‌کنه، این یکی
// خودش عبارت ریاضی رو بر حسب x نمونه‌برداری می‌کنه — برای دیدن رفتار یک تابع یا مقایسه‌ی
// چند معادله با هم (مثل sin(x) در برابر cos(x)) روی یک نمودار.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

const WIDTH = 640;
const HEIGHT = 360;
const PAD = { top: 34, right: 20, bottom: 44, left: 54 };
const PALETTE = ['#e0a94e', '#4e8fe0', '#6ee08e', '#e04e6e', '#a94ee0'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// فقط توابع/ثابت‌های استاندارد Math مجازند — برای جلوگیری از دسترسی به هرچیز دیگه
const SAFE_NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sqrt', 'cbrt',
  'log', 'log2', 'log10', 'exp', 'abs', 'pow', 'min', 'max', 'floor', 'ceil', 'round', 'sign', 'PI', 'E'];
const ALLOWED_CHARS = /^[0-9x+\-*/().\s,^%a-zA-Z_]+$/;

function compileExpr(expr) {
  if (!ALLOWED_CHARS.test(expr)) throw new Error('عبارت شامل کاراکتر غیرمجاز است.');
  const words = expr.match(/[a-zA-Z_]+/g) || [];
  for (const w of words) {
    if (w === 'x') continue;
    if (!SAFE_NAMES.includes(w)) throw new Error(`اسم غیرمجاز در عبارت: «${w}» — فقط توابع استاندارد ریاضی مجازند.`);
  }
  const body = `const {${SAFE_NAMES.join(',')}} = Math; return (${expr});`;
  // eslint-disable-next-line no-new-func
  return new Function('x', body);
}

module.exports = {
  name: 'plot_function',
  description:
    'رسم نمودار یک یا چند معادله/تابع ریاضی بر حسب x (مثل "sin(x)"، "x^2 - 3*x + 2" یا "sqrt(x)") روی یک بازه‌ی مشخص، به‌شکل SVG. ' +
    'برای درک بصری رفتار یک معادله‌ی پیچیده، بررسی ریشه‌ها/بیشینه-کمینه، یا مقایسه‌ی چند فرمول با هم روی یک نمودار استفاده کن (تا ۵ معادله هم‌زمان). ' +
    'بعد از ساختن فایل، برای نمایش نمودار داخل خود پاسخ از سینتکس مارک‌داون تصویر استفاده کن: ![توضیح](outputPath).',
  input_schema: {
    type: 'object',
    properties: {
      expressions: { type: 'array', items: { type: 'string' }, description: 'عبارت‌های ریاضی بر حسب x (حداکثر ۵ تا)، مثلاً ["sin(x)", "cos(x)"]' },
      labels: { type: 'array', items: { type: 'string' }, description: 'برچسب هر معادله برای Legend (اختیاری)' },
      xMin: { type: 'number' },
      xMax: { type: 'number' },
      samples: { type: 'number', description: 'تعداد نقاط نمونه‌برداری (پیش‌فرض ۱۲۰، حداکثر ۴۰۰)' },
      title: { type: 'string' },
      outputPath: { type: 'string', description: 'مسیر نسبی فایل خروجی .svg داخل workspace' },
    },
    required: ['expressions', 'xMin', 'xMax', 'outputPath'],
  },
  permission: 'green',
  handler: async ({ expressions, labels, xMin, xMax, samples, title, outputPath }) => {
    if (!Array.isArray(expressions) || expressions.length === 0) return 'خطا: expressions باید آرایه‌ی غیرخالی باشد.';
    if (expressions.length > 5) return 'خطا: حداکثر ۵ معادله در یک نمودار پشتیبانی می‌شود.';
    if (!(xMax > xMin)) return 'خطا: xMax باید بزرگ‌تر از xMin باشد.';
    const n = Math.min(Math.max(Math.floor(samples || 120), 10), 400);

    let fns;
    try {
      fns = expressions.map(compileExpr);
    } catch (err) {
      return `خطا در عبارت: ${err.message}`;
    }

    const series = fns.map((fn) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        let y;
        try { y = fn(x); } catch { y = NaN; }
        pts.push({ x, y: Number.isFinite(y) ? y : null });
      }
      return pts;
    });

    const allY = series.flat().map((p) => p.y).filter((y) => y !== null);
    if (allY.length === 0) return 'خطا: هیچ مقدار عددی معتبری از این عبارت‌ها به‌دست نیامد (شاید بازه مناسب نباشد).';

    let yMin = Math.min(...allY), yMax = Math.max(...allY);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yRange = yMax - yMin;
    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const xOf = (x) => PAD.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const yOf = (y) => PAD.top + plotH - ((y - yMin) / yRange) * plotH;

    let body = '';
    body += `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${HEIGHT - PAD.bottom}" stroke="#888" />`;
    body += `<line x1="${PAD.left}" y1="${HEIGHT - PAD.bottom}" x2="${WIDTH - PAD.right}" y2="${HEIGHT - PAD.bottom}" stroke="#888" />`;
    if (yMin < 0 && yMax > 0) {
      body += `<line x1="${PAD.left}" y1="${yOf(0).toFixed(1)}" x2="${WIDTH - PAD.right}" y2="${yOf(0).toFixed(1)}" stroke="#555" stroke-dasharray="3,3" />`;
    }

    series.forEach((pts, si) => {
      const color = PALETTE[si % PALETTE.length];
      let d = '';
      let drawing = false;
      pts.forEach((p) => {
        if (p.y === null) { drawing = false; return; }
        d += `${drawing ? 'L' : 'M'}${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)} `;
        drawing = true;
      });
      body += `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="2.2" />`;
    });

    let legend = '';
    const legendLabels = labels && labels.length === expressions.length ? labels : expressions;
    legendLabels.forEach((lbl, i) => {
      const color = PALETTE[i % PALETTE.length];
      const ly = PAD.top + i * 16;
      legend += `<rect x="${WIDTH - PAD.right - 130}" y="${ly - 9}" width="10" height="10" fill="${color}" />`;
      legend += `<text x="${WIDTH - PAD.right - 116}" y="${ly}" font-size="11" fill="#ccc">${esc(String(lbl).slice(0, 20))}</text>`;
    });

    body += `<text x="${PAD.left - 8}" y="${(PAD.top + 4).toFixed(1)}" font-size="10" fill="#ccc" text-anchor="end">${yMax.toFixed(2)}</text>`;
    body += `<text x="${PAD.left - 8}" y="${(HEIGHT - PAD.bottom).toFixed(1)}" font-size="10" fill="#ccc" text-anchor="end">${yMin.toFixed(2)}</text>`;
    body += `<text x="${PAD.left}" y="${HEIGHT - PAD.bottom + 18}" font-size="10" fill="#ccc">${xMin}</text>`;
    body += `<text x="${WIDTH - PAD.right}" y="${HEIGHT - PAD.bottom + 18}" font-size="10" fill="#ccc" text-anchor="end">${xMax}</text>`;

    const titleEl = title
      ? `<text x="${WIDTH / 2}" y="18" font-size="14" fill="#eee" text-anchor="middle" font-weight="bold">${esc(title)}</text>`
      : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
      `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0c0f14" />` + titleEl + body + legend + `</svg>`;

    const full = safePath(outputPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, svg, 'utf8');

    return `نمودار ${expressions.length} معادله رسم شد: ${outputPath} (x از ${xMin} تا ${xMax}, y از ${yMin.toFixed(2)} تا ${yMax.toFixed(2)})`;
  },
};

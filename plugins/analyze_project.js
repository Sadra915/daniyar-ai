// plugins/analyze_project.js — تشخیص خودکار نوع پروژه، دقیقاً همون منطقی که
// persona.md بهش اشاره کرده: package.json→Node, requirements.txt→Python,
// Cargo.toml→Rust, pom.xml→Java. برای استفاده بعد از unzip_project یا
// روی هر پوشه‌ای که از قبل داخل workspace هست.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

const MARKERS = {
  'package.json': 'Node.js / JavaScript',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'Cargo.toml': 'Rust',
  'pom.xml': 'Java (Maven)',
  'build.gradle': 'Java/Kotlin (Gradle)',
  'go.mod': 'Go',
  'composer.json': 'PHP',
  Gemfile: 'Ruby',
};

function walk(dir, depth, base) {
  if (depth > 3) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  let result = [];
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    result.push({ name: rel, type: e.isDirectory() ? 'dir' : 'file' });
    if (e.isDirectory() && depth < 2) {
      result = result.concat(walk(path.join(dir, e.name), depth + 1, rel));
    }
  }
  return result;
}

module.exports = {
  name: 'analyze_project',
  description:
    'ساختار یک پوشه‌ی پروژه‌ی داخل workspace را بررسی کن و استک فنی‌اش را از روی فایل‌های ' +
    'علامت‌گذار (package.json، requirements.txt، Cargo.toml، pom.xml و...) تشخیص بده.',
  input_schema: {
    type: 'object',
    properties: {
      projectFolder: { type: 'string', description: 'مسیر نسبی پوشه داخل workspace، مثلاً projects/myapp' },
    },
    required: ['projectFolder'],
  },
  permission: 'green',
  handler: async ({ projectFolder }) => {
    const dir = safePath(projectFolder);
    if (!fs.existsSync(dir)) return `خطا: پوشه پیدا نشد: ${projectFolder}`;

    const tree = walk(dir, 0, '');
    const stacks = Object.entries(MARKERS)
      .filter(([file]) => tree.some((t) => t.name === file))
      .map(([, stack]) => stack);

    let packageInfo = '';
    if (tree.some((t) => t.name === 'package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        packageInfo = `\n\npackage.json:\n- name: ${pkg.name || '-'}\n- scripts: ${Object.keys(pkg.scripts || {}).join(', ') || '-'}\n- dependencies: ${Object.keys(pkg.dependencies || {}).join(', ') || '-'}`;
      } catch { /* پارس نشد، مهم نیست */ }
    }

    const topLevel = tree.filter((t) => !t.name.includes('/')).map((t) => (t.type === 'dir' ? `${t.name}/` : t.name));

    return (
      `استک تشخیص داده‌شده: ${stacks.length ? stacks.join(', ') : 'نامشخص'}\n` +
      `تعداد فایل‌ها: ${tree.filter((t) => t.type === 'file').length}\n` +
      `ریشه‌ی پروژه:\n${topLevel.join('\n')}` +
      packageInfo
    );
  },
};

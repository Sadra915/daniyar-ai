// plugins/scaffold_project.js — «Project Builder» + «Workspace Templates» از سند اصلی، نسخه‌ی واقعی:
// به‌جای صرفاً نوشتن کد آزاد، یک اسکلت پروژه‌ی استاندارد و قابل‌اجرا با یک فراخوانی می‌سازد.
// بعد از این، ادامه‌ی کار (نوشتن فیچرها) با write_file/edit_file انجام می‌شود.
const fs = require('fs');
const path = require('path');
const { safePath } = require('./_workspace-utils');

const TEMPLATES = {
  'node-express-api': {
    label: 'Node.js + Express API',
    files: {
      'package.json': (name) => JSON.stringify({
        name, version: '0.1.0', main: 'index.js', type: 'commonjs',
        scripts: { start: 'node index.js', test: 'node --test' },
        dependencies: { express: '^4.19.2' },
      }, null, 2),
      'index.js':
        `const express = require('express');\nconst app = express();\napp.use(express.json());\n\n` +
        `app.get('/health', (req, res) => res.json({ ok: true }));\n\n` +
        `const PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log('listening on ' + PORT));\n\n` +
        `module.exports = app;\n`,
      'test/health.test.js':
        `const test = require('node:test');\nconst assert = require('node:assert');\n\n` +
        `test('placeholder', () => { assert.strictEqual(1 + 1, 2); });\n`,
      '.gitignore': 'node_modules/\n.env\n',
      'README.md': (name) => `# ${name}\n\nساخته شده با scaffold_project (node-express-api).\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`,
    },
  },
  'node-cli': {
    label: 'Node.js CLI Tool',
    files: {
      'package.json': (name) => JSON.stringify({
        name, version: '0.1.0', main: 'index.js', type: 'commonjs',
        bin: { [name]: './index.js' },
        scripts: { start: 'node index.js', test: 'node --test' },
      }, null, 2),
      'index.js': `#!/usr/bin/env node\nconst args = process.argv.slice(2);\nconsole.log('args:', args);\n`,
      'test/index.test.js':
        `const test = require('node:test');\nconst assert = require('node:assert');\n\n` +
        `test('placeholder', () => { assert.strictEqual(1 + 1, 2); });\n`,
      '.gitignore': 'node_modules/\n',
      'README.md': (name) => `# ${name}\n\nیک CLI Tool ساده. \`node index.js\` را اجرا کن.\n`,
    },
  },
  'python-fastapi': {
    label: 'Python + FastAPI',
    files: {
      'requirements.txt': 'fastapi\nuvicorn\npytest\n',
      'main.py':
        `from fastapi import FastAPI\n\napp = FastAPI()\n\n\n` +
        `@app.get("/health")\ndef health():\n    return {"ok": True}\n`,
      'test_main.py':
        `def test_placeholder():\n    assert 1 + 1 == 2\n`,
      '.gitignore': '__pycache__/\n.venv/\n*.pyc\n',
      'README.md': (name) => `# ${name}\n\n\`\`\`bash\npip install -r requirements.txt\nuvicorn main:app --reload\n\`\`\`\n`,
    },
  },
  'static-html': {
    label: 'Static HTML/CSS/JS',
    files: {
      'index.html':
        `<!DOCTYPE html>\n<html lang="fa" dir="rtl">\n<head>\n<meta charset="UTF-8">\n` +
        `<title>پروژه جدید</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n` +
        `<h1>سلام دنیا</h1>\n<script src="script.js"></script>\n</body>\n</html>\n`,
      'style.css': 'body { font-family: sans-serif; margin: 2rem; }\n',
      'script.js': "console.log('ready');\n",
      'README.md': (name) => `# ${name}\n\nیک صفحه‌ی استاتیک ساده. index.html را در مرورگر باز کن.\n`,
    },
  },
};

module.exports = {
  name: 'scaffold_project',
  description:
    `یک اسکلت پروژه‌ی استاندارد و قابل‌اجرا در workspace/projects بساز (نه فقط یک فایل خالی). ` +
    `قالب‌های موجود: ${Object.entries(TEMPLATES).map(([k, v]) => `${k} (${v.label})`).join('، ')}. ` +
    `بعد از ساخت، با install_package/run_shell وابستگی‌ها را نصب کن و با run_build_test تست بگیر.`,
  input_schema: {
    type: 'object',
    properties: {
      template: { type: 'string', enum: Object.keys(TEMPLATES) },
      projectName: { type: 'string', description: 'اسم پروژه و پوشه‌ی مقصد داخل workspace/projects' },
    },
    required: ['template', 'projectName'],
  },
  permission: 'yellow',
  handler: async ({ template, projectName }) => {
    const tpl = TEMPLATES[template];
    if (!tpl) return `خطا: قالب نامعتبر. گزینه‌های موجود: ${Object.keys(TEMPLATES).join(', ')}`;

    const name = projectName.replace(/[^\w\-.]/g, '_');
    const destRel = path.join('projects', name);
    const destFull = safePath(destRel);
    if (fs.existsSync(destFull)) return `خطا: پوشه از قبل وجود دارد: workspace/${destRel} (اسم دیگری انتخاب کن یا اول حذفش کن)`;

    const created = [];
    for (const [relFile, contentOrFn] of Object.entries(tpl.files)) {
      const content = typeof contentOrFn === 'function' ? contentOrFn(name) : contentOrFn;
      const full = path.join(destFull, relFile);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      created.push(relFile);
    }

    return (
      `پروژه‌ی «${name}» با قالب ${tpl.label} ساخته شد در workspace/${destRel}:\n${created.join('\n')}\n\n` +
      `قدم بعدی: analyze_project(projectFolder="${destRel}") و بعد نصب وابستگی‌ها.`
    );
  },
};

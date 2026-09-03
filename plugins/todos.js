// plugins/todos.js — لیست کارها (todo).
const fs = require('fs');
const path = require('path');
const TODOS_PATH = path.join(__dirname, '..', 'memory', 'todos.json');

function ensure() {
  const dir = path.dirname(TODOS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(TODOS_PATH)) fs.writeFileSync(TODOS_PATH, '[]');
}
function readAll() { ensure(); return JSON.parse(fs.readFileSync(TODOS_PATH, 'utf8')); }
function writeAll(list) { ensure(); fs.writeFileSync(TODOS_PATH, JSON.stringify(list, null, 2)); }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

module.exports = {
  name: 'todos',
  description: 'لیست کارهای کاربر را مدیریت کن: افزودن (add)، لیست (list)، یا تکمیل کردن (complete) یک کار.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'list', 'complete'] },
      task: { type: 'string' },
      id: { type: 'string' },
    },
    required: ['action'],
  },
  permission: 'green',
  handler: async ({ action, task, id }) => {
    if (action === 'add') {
      const todos = readAll();
      const entry = { id: newId(), task, done: false, ts: new Date().toISOString() };
      todos.push(entry);
      writeAll(todos);
      return `کار اضافه شد: ${task}`;
    }
    if (action === 'list') {
      return JSON.stringify(readAll(), null, 2);
    }
    if (action === 'complete') {
      const todos = readAll();
      const t = todos.find(x => x.id === id);
      if (!t) return `خطا: کاری با id=${id} پیدا نشد.`;
      t.done = true;
      writeAll(todos);
      return `تکمیل شد: ${t.task}`;
    }
    return 'خطا: action نامعتبر است.';
  },
};

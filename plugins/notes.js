// plugins/notes.js — یادداشت‌های آزاد، جدا از حافظه‌ی ساختاریافته‌ی پروژه/کاربر.
const fs = require('fs');
const path = require('path');
const NOTES_PATH = path.join(__dirname, '..', 'memory', 'notes.json');

function ensure() {
  const dir = path.dirname(NOTES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(NOTES_PATH)) fs.writeFileSync(NOTES_PATH, '[]');
}
function readAll() { ensure(); return JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8')); }
function writeAll(list) { ensure(); fs.writeFileSync(NOTES_PATH, JSON.stringify(list, null, 2)); }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

module.exports = {
  name: 'notes',
  description: 'یادداشت‌های آزاد کاربر را مدیریت کن: ذخیره (save)، لیست (list)، یا حذف (delete) یک یادداشت.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['save', 'list', 'delete'] },
      title: { type: 'string' },
      content: { type: 'string' },
      id: { type: 'string' },
    },
    required: ['action'],
  },
  permission: 'green',
  handler: async ({ action, title, content, id }) => {
    if (action === 'save') {
      const notes = readAll();
      const entry = { id: newId(), title: title || '(بدون عنوان)', content: content || '', ts: new Date().toISOString() };
      notes.push(entry);
      writeAll(notes);
      return `یادداشت ذخیره شد: ${entry.title}`;
    }
    if (action === 'list') {
      return JSON.stringify(readAll(), null, 2);
    }
    if (action === 'delete') {
      const notes = readAll().filter(n => n.id !== id);
      writeAll(notes);
      return `یادداشت حذف شد: ${id}`;
    }
    return 'خطا: action نامعتبر است.';
  },
};

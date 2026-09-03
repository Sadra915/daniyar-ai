// plugins/_workspace-utils.js
// شروع با _ یعنی خودش یک ابزار نیست، فقط helper مشترک برای بقیه پلاگین‌هاست.
// plugin-loader فایل‌هایی که mod.name ندارن رو رد می‌کنه، پس این فایل امن جا می‌مونه.
const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..', 'workspace');
if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });

function safePath(relPath) {
  const resolved = path.resolve(WORKSPACE, relPath || '.');
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error('دسترسی خارج از Workspace مجاز نیست.');
  }
  return resolved;
}

module.exports = { WORKSPACE, safePath };

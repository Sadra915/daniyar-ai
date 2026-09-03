// plugins/_github-auth-utils.js — شروع با _ یعنی پلاگین نیست، فقط helper مشترک بین
// github_auth.js و git_local.js (برای push) و github_repo.js (برای دسترسی خصوصی بیشتر).
// توکن عمداً در memory/ ذخیره می‌شه، نه workspace/ — چون workspace ممکنه export/zip بشه
// و توکن نباید هیچ‌وقت تو یک فایل خروجی که دست کاربر می‌ره سر از اونجا دربیاره.
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, '..', 'memory', 'github-token.json');

function saveToken(data) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function clearToken() {
  if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
}

module.exports = { saveToken, loadToken, clearToken, TOKEN_PATH };

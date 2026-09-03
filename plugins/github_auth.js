// plugins/github_auth.js — «GitHub OAuth واقعی» که در README به‌عنوان محدودیت شناخته‌شده
// ثبت شده بود. از GitHub OAuth Device Flow استفاده می‌کنه چون این اپ یک برنامه‌ی دسکتاپی/
// محلیه، نه یک وب‌سرور با redirect URL عمومی — Device Flow دقیقاً برای همین سناریو طراحی شده
// (بدون نیاز به هیچ redirect، فقط یک کد که کاربر تو مرورگرش وارد می‌کنه).
//
// پیش‌نیاز: باید یک GitHub OAuth App بسازی (github.com/settings/developers → New OAuth App)،
// Device Flow را در تنظیماتش فعال کنی، و Client ID را در .env به‌عنوان GITHUB_OAUTH_CLIENT_ID بذاری.
// بدون این، این پلاگین کار نمی‌کند — و همین را صریح می‌گوید، نه اینکه وانمود کند وصل شده.
const { saveToken, loadToken, clearToken } = require('./_github-auth-utils');

async function postForm(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

module.exports = {
  name: 'github_auth',
  description:
    'اتصال واقعی به GitHub با OAuth Device Flow. action=start یک کد و آدرس می‌سازد که باید به کاربر نشان دهی ' +
    'تا در مرورگرش وارد کند؛ action=poll بعد از چند ثانیه چک می‌کند که آیا کاربر تأییدش کرده یا نه ' +
    '(اگر هنوز نه، دوباره چند ثانیه صبر کن و poll را تکرار کن). action=status وضعیت فعلی را می‌گوید. ' +
    'action=logout توکن ذخیره‌شده را پاک می‌کند.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'poll', 'status', 'logout'] },
    },
    required: ['action'],
  },
  permission: 'yellow',
  handler: async ({ action }) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;

    if (action === 'status') {
      const token = loadToken();
      if (!token) return 'وصل نیست. برای اتصال، action=start را اجرا کن.';
      if (token.status === 'pending') return `در انتظار تأیید کاربر است (کد: ${token.user_code}، آدرس: ${token.verification_uri}).`;
      return `وصل است (scope: ${token.scope || 'نامشخص'}).`;
    }

    if (action === 'logout') {
      clearToken();
      return 'توکن پاک شد. اتصال قطع شد.';
    }

    if (!clientId) {
      return 'خطا: GITHUB_OAUTH_CLIENT_ID در .env تنظیم نشده. اول یک GitHub OAuth App بساز ' +
        '(github.com/settings/developers → New OAuth App → Enable Device Flow) و Client ID را در .env بگذار.';
    }

    if (action === 'start') {
      const data = await postForm('https://github.com/login/device/code', { client_id: clientId, scope: 'repo' });
      if (data.error) return `خطا از GitHub: ${data.error_description || data.error}`;

      saveToken({
        status: 'pending',
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        interval: data.interval || 5,
        expires_at: Date.now() + (data.expires_in || 900) * 1000,
      });

      return `برای اتصال به GitHub:\n1) این آدرس را در مرورگر باز کن: ${data.verification_uri}\n` +
        `2) این کد را وارد کن: ${data.user_code}\n` +
        `بعد از وارد کردن کد، به من بگو "poll کن" (یا دوباره action=poll بزن) تا وضعیت را چک کنم.`;
    }

    if (action === 'poll') {
      const pending = loadToken();
      if (!pending || pending.status !== 'pending') return 'هیچ درخواست در انتظاری نیست. اول action=start را اجرا کن.';
      if (Date.now() > pending.expires_at) { clearToken(); return 'کد منقضی شد. دوباره action=start را اجرا کن.'; }

      const data = await postForm('https://github.com/login/oauth/access_token', {
        client_id: clientId,
        device_code: pending.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      if (data.error === 'authorization_pending') return `هنوز تأیید نشده. ${pending.interval} ثانیه صبر کن و دوباره poll کن.`;
      if (data.error === 'slow_down') return `کمی کندتر poll کن (فاصله را ${(pending.interval || 5) + 5} ثانیه کن).`;
      if (data.error === 'expired_token') { clearToken(); return 'کد منقضی شد. دوباره action=start را اجرا کن.'; }
      if (data.error === 'access_denied') { clearToken(); return 'کاربر اتصال را رد کرد.'; }
      if (data.error) return `خطا از GitHub: ${data.error_description || data.error}`;

      saveToken({ status: 'authorized', access_token: data.access_token, scope: data.scope, authorized_at: Date.now() });
      return `✅ وصل شد! حالا git_local می‌تواند push کند و github_auth/github_repo به ریپوهای خصوصی هم دسترسی دارند.`;
    }

    return 'خطا: action نامعتبر است.';
  },
};

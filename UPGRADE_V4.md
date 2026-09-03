# Daniyar AI V4 Pro

این نسخه روی همان هسته Node/Express پروژه‌ی V3 ساخته شده، اما سه بخش اساسی ارتقا یافته‌اند:

- رابط کاربری کاملاً بازطراحی شده، mobile-first و مناسب WebView/ToApp با انیمیشن، command palette، bottom navigation، drag/drop و طراحی شیشه‌ای.
- Agent اکنون Provider-agnostic است: OpenRouter، Ollama و Anthropic. برای OpenRouter از API سازگار با Chat Completions و tool-calling استفاده می‌شود.
- Plugin Hub واقعی‌تر شده است: کشف خودکار ماژول‌های `plugins/*.js`، دسته‌بندی، جستجو و روشن/خاموش کردن پلاگین‌ها بدون دستکاری هسته.

## اجرای سریع

```bash
cd ~/Daniyar/daniyar-ai
rm -rf node_modules package-lock.json
npm install
cp .env.example .env
npm start
```

برای OpenRouter:
```env
AI_PROVIDER=openrouter
OPENROUTER_MODEL=openrouter/free
OPENROUTER_API_KEY=کلید_خودت
```

برای مدل کدنویسی پولی/قدرتمندتر می‌توانی `OPENROUTER_MODEL` را به یک مدل سازگار مثل `z-ai/glm-5.3-flash` تغییر بدهی.

برای Ollama:
```env
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

## نکته درباره هزاران پلاگین

به‌جای ساختن هزاران پلاگین جعلی، معماری Plugin Hub طوری نگه داشته شده که هر فایل واقعی در `plugins/` یک قابلیت مستقل باشد و سیستم بتواند آن‌ها را خودکار کشف کند. این ظرفیت از نظر معماری محدود به یک عدد ثابت نیست؛ پلاگین‌های واقعی را می‌توان به صورت drop-in اضافه کرد.

## ایمنی

`run_shell` و Terminal همچنان اجرای واقعی روی محیط میزبان را ممکن می‌کنند. روی دستگاه شخصی قابل استفاده‌اند، اما برای سرویس عمومی اینترنتی باید احراز هویت و sandbox واقعی اضافه شود و `ALLOW_SHELL=false` قابل‌توصیه است.

# Daniyar AI Pro V3

یک AI workspace محلی و قابل توسعه با Chat، Studio، IDE، حافظه، پروژه، Agent و سیستم Plugin Hub.

## راه‌اندازی رایگان

1. Node.js 18+ نصب کنید.
2. Ollama را نصب و اجرا کنید.
3. یک مدل محلی بگیرید، نمونه:

```bash
ollama pull llama3.2
```

4. وابستگی‌ها:

```bash
npm install
```

5. `.env` را از `.env.example` بسازید و برای اجرای محلی:

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
ALLOW_SHELL=true
```

6. اجرا:

```bash
npm start
```

سپس `http://localhost:3000` را باز کنید.

## Plugin Hub

هر ابزار در `plugins/*.js` یک پلاگین است. از بخش «پلاگین‌ها» می‌توانید ابزارهای موجود را روشن/خاموش کنید. وضعیت در `memory/plugin-registry.json` ذخیره می‌شود. برای افزودن پلاگین جدید، یک ماژول با `name`, `description`, `input_schema`, `permission`, `handler` بسازید.

> نکته امنیتی: `run_shell` و Terminal اجرای فرمان روی ماشین میزبان را ممکن می‌کنند. برای محیط عمومی/اینترنتی، احراز هویت و sandbox واقعی (مثلاً container) اضافه کنید و `ALLOW_SHELL=false` بگذارید.

## قابلیت‌های V3

- Plugin Hub و فعال/غیرفعال‌سازی پلاگین
- System Monitor و سلامت Ollama
- Workspace tree API
- Chat/Studio/IDE و Terminal
- حافظه و پروژه‌های پایدار
- Activity log
- Export و ابزارهای داده/کد
- Command Palette و میانبرها
- Dark/Light و Reduced Motion
- Drag & Drop فایل
- طراحی Responsive

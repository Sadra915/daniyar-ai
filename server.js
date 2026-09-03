require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { execFile } = require('child_process');
const { runAgent, MODEL } = require('./agent');
const memoryManager = require('./memory-manager');
const { loadPlugins } = require('./plugin-loader');
const pluginRegistry = require('./plugin-registry');
const { safePath, WORKSPACE } = require('./plugins/_workspace-utils');

const app = express();

// WebView / ToApp support. Requests from a packaged local HTML file often have
// an Origin such as null, so the API must accept cross-origin requests.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const upload = multer({ dest: path.join(__dirname, 'workspace') });

// --- Activity Log: هر tool_start/tool_end روی دیسک ثبت می‌شه، برای صفحه‌ی «فعالیت» در UI ---
const ACTIVITY_LOG_PATH = path.join(__dirname, 'memory', 'activity-log.json');
const MAX_LOG_ENTRIES = 300;

function appendActivity(entry) {
  try {
    fs.mkdirSync(path.dirname(ACTIVITY_LOG_PATH), { recursive: true });
    let log = [];
    if (fs.existsSync(ACTIVITY_LOG_PATH)) {
      try { log = JSON.parse(fs.readFileSync(ACTIVITY_LOG_PATH, 'utf8')); } catch { log = []; }
    }
    log.push({ ...entry, ts: new Date().toISOString() });
    if (log.length > MAX_LOG_ENTRIES) log = log.slice(-MAX_LOG_ENTRIES);
    fs.writeFileSync(ACTIVITY_LOG_PATH, JSON.stringify(log, null, 2));
  } catch { /* لاگ نشد، مهم نیست — نباید جلوی چت رو بگیره */ }
}

// --- Chat endpoint: provider-agnostic SSE ---
app.post('/api/chat', async (req, res) => {
  const { messages, provider = process.env.AI_PROVIDER || 'openrouter', model } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages نامعتبر است.' });
  }

  const requestedProvider = String(provider || 'openrouter').toLowerCase();
  const selectedModel = model || process.env.DANIYAR_MODEL || process.env.OPENROUTER_MODEL || process.env.OLLAMA_MODEL || 'openrouter/free';
  const supported = new Set(['openrouter','ollama','anthropic']);
  if (!supported.has(requestedProvider)) {
    return res.status(400).json({ error: `Provider نامعتبر: ${requestedProvider}` });
  }
  if (requestedProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'OPENROUTER_API_KEY تنظیم نشده. آن را در .env قرار بده یا Provider محلی Ollama را انتخاب کن.' });
  }
  if (requestedProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY تنظیم نشده.' });
  }

  res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control','no-cache, no-transform');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();

  const send=(event,data)=>{
    if (res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runAgent({
      messages,
      provider: requestedProvider,
      model: selectedModel,
      onStep: (step) => {
        send('step', step);
        if (step.type === 'tool_start' || step.type === 'tool_end') appendActivity(step);
      },
    });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    send('done', {});
    res.end();
  }
});

// --- Activity Log (برای صفحه‌ی «فعالیت» در UI) ---
app.get('/api/activity', (req, res) => {
  try {
    if (!fs.existsSync(ACTIVITY_LOG_PATH)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(ACTIVITY_LOG_PATH, 'utf8')));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Meta: مدل فعلی و لیست ابزارهای واقعاً فعال ---
app.get('/api/plugins', (req,res)=>res.json(pluginRegistry.list()));
app.post('/api/plugins/:name/toggle', (req,res)=>{
  try { const enabled = req.body?.enabled !== false; res.json(pluginRegistry.setEnabled(req.params.name, enabled)); }
  catch(err){ res.status(400).json({error:err.message}); }
});
app.post('/api/plugins/reload', (req,res)=>res.json(pluginRegistry.list()));

app.get('/api/system', (req,res)=>{
  const mem=process.memoryUsage();
  res.json({node:process.version,platform:process.platform,arch:process.arch,uptime:process.uptime(),memory:{rss:mem.rss,heapUsed:mem.heapUsed,heapTotal:mem.heapTotal},cwd:process.cwd(),time:new Date().toISOString()});
});

app.get('/api/workspace/tree', (req,res)=>{
  function walk(dir, depth=0){ if(depth>3)return []; let out=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(e.name.startsWith('.')||e.name==='node_modules')continue; const full=path.join(dir,e.name); const item={name:e.name,type:e.isDirectory()?'dir':'file'}; if(e.isDirectory()) item.children=walk(full,depth+1); out.push(item); } return out; }
  try{res.json(walk(WORKSPACE));}catch(err){res.status(400).json({error:err.message});}
});

app.get('/api/meta', (req, res) => {
  try {
    const { tools, handlers, failed } = loadPlugins();
    res.json({
      model: MODEL,
      provider: process.env.AI_PROVIDER || 'openrouter',
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        permission: handlers[t.name]?.permission || 'green',
      })),
      failedPlugins: failed || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message, tools: [], failedPlugins: [] });
  }
});

// Plugin Hub catalog: built-ins are real filesystem modules; marketplace entries are
// capability packs that can be implemented as drop-in plugins without changing core.
app.get('/api/plugins/catalog', (req, res) => {
  const { tools, failed } = loadPlugins();
  const registry = pluginRegistry.list();
  const categories = {
    'کدنویسی': ['analyze_project','read_file','write_file','write_files','edit_file','search_code','run_build_test','run_lint','scaffold_project','diff_files'],
    'فایل': ['list_files','manage_file','unzip_project','zip_files','export_project','read_document','convert_file'],
    'داده': ['analyze_data','convert_data','generate_chart','plot_function','calculate','json_tools','number_tools','csv_tools','array_tools','json_diff'],
    'وب و شبکه': ['web_search','http_request','get_weather','get_datetime'],
    'پروژه و حافظه': ['switch_project','project_memory','remember_fact','todos','notes','project_snapshot'],
    'GitHub': ['github_auth','github_repo'],
    'سیستم': ['run_shell','run_sandboxed','install_package','db_lab','apk_analyzer'],
    'رسانه و خروجی': ['preview_project'],
    'متن': ['base64_tools','line_tools','word_frequency','slugify','markdown_tools','regex_tool'],
    'طراحی': ['color_tools','css_tokens'],
    'امنیت': ['password_strength'],
  };
  const pluginRows = (registry.plugins || tools).map(t => {
    const category = Object.keys(categories).find(c => categories[c].includes(t.name)) || 'عمومی';
    return { ...t, category: t.category || category, icon: t.icon || '✦', version: t.version || '1.0.0', status:'installed', source:'builtin' };
  });
  res.json({
    totalInstalled: pluginRows.filter(x=>x.enabled!==false).length,
    installedCount: pluginRows.length,
    disabledCount: pluginRows.filter(x=>x.enabled===false).length,
    failed: failed || [],
    categories: Object.keys(categories),
    architecture: 'filesystem-discovery',
    pluginCapacity: 'نامحدود از نظر معماری؛ فقط ماژول‌های واقعی موجود/نصب‌شده نمایش داده می‌شوند.',
    plugins: pluginRows,
  });
});

app.get('/api/config', (req, res) => res.json({
  provider: process.env.AI_PROVIDER || 'openrouter',
  model: process.env.DANIYAR_MODEL || process.env.OPENROUTER_MODEL || 'openrouter/free',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  shell: process.env.ALLOW_SHELL !== 'false',
}));

// --- Session (پروژه‌ی فعال) ---
app.get('/api/session', (req, res) => res.json(memoryManager.getSession()));
app.post('/api/session/active-project', (req, res) => res.json(memoryManager.setActiveProject(req.body.project || null)));

// --- User memory ---
app.get('/api/memory/user', (req, res) => res.json(memoryManager.getUserMemory()));
app.post('/api/memory/user', (req, res) => res.json(memoryManager.addUserFact(req.body.fact)));
app.delete('/api/memory/user/:id', (req, res) => res.json(memoryManager.deleteUserFact(req.params.id)));

// --- Projects / project memory ---
app.get('/api/projects', (req, res) => res.json(memoryManager.listProjects()));
app.post('/api/projects', (req, res) => res.json(memoryManager.createProject(req.body.name)));
app.get('/api/projects/:name', (req, res) => res.json(memoryManager.getProjectMemory(req.params.name)));
app.delete('/api/projects/:name', (req, res) => res.json(memoryManager.deleteProject(req.params.name)));
app.put('/api/projects/:name', (req, res) => res.json(memoryManager.updateProjectMemory(req.params.name, req.body || {})));
app.post('/api/projects/:name/fact', (req, res) => res.json(memoryManager.addProjectFact(req.params.name, req.body.fact)));
app.delete('/api/projects/:name/fact/:id', (req, res) => res.json(memoryManager.deleteProjectFact(req.params.name, req.params.id)));

// --- Files (workspace/) ---
app.get('/api/files', (req, res) => {
  try {
    const dir = safePath(req.query.path || '.');
    const entries = fs.readdirSync(dir, { withFileTypes: true }).map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      size: e.isDirectory() ? null : fs.statSync(path.join(dir, e.name)).size,
    }));
    res.json(entries);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/files/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایلی دریافت نشد.' });
  const dest = path.join(WORKSPACE, req.file.originalname);
  fs.renameSync(req.file.path, dest);
  res.json({ uploaded: req.file.originalname });
});

// --- دانلود یک فایل داخل workspace (مثلاً خروجی export_project) ---
app.get('/api/download', (req, res) => {
  try {
    const full = safePath(req.query.path || '');
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return res.status(404).json({ error: 'فایل پیدا نشد.' });
    }
    res.download(full);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Web Preview: سرو استاتیک یک پروژه‌ی داخل workspace/projects/<name> (بخش «Web Preview» سند اصلی) ---
// فقط فایل‌های استاتیک (HTML/CSS/JS/تصویر) — برای پروژه‌هایی با Backend واقعی کار نمی‌کند.
app.get('/preview/:name', (req, res) => res.redirect(`/preview/${req.params.name}/index.html`));
app.get('/preview/:name/*', (req, res) => {
  try {
    const relFile = req.params[0] || 'index.html';
    const full = safePath(path.join('projects', req.params.name, relFile));
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return res.status(404).send('فایل پیدا نشد. (پروژه باید index.html در ریشه داشته باشد — preview_project را چک کن)');
    }
    res.sendFile(full);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// --- Notes / Todos (فایل‌های JSON ساده، برای نمایش در UI) ---
function readJSONSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return []; }
}
app.get('/api/notes', (req, res) => res.json(readJSONSafe(path.join(__dirname, 'memory', 'notes.json'))));
app.get('/api/todos', (req, res) => res.json(readJSONSafe(path.join(__dirname, 'memory', 'todos.json'))));

// --- نمایش inline یک فایل داخل workspace (برای دیدن SVG/تصویر مستقیم تو مرورگر، نه دانلود) ---
app.get('/api/view', (req, res) => {
  try {
    const full = safePath(req.query.path || '');
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return res.status(404).send('فایل پیدا نشد.');
    res.sendFile(full);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ==================================================
// Code Editor — این مسیرها مستقیم از UI صدا زده می‌شن (خودِ کاربر داره ویرایش
// می‌کنه، نه Agent)، پس نیازی به تأیید permission پلاگین‌ها ندارن.
// ==================================================
app.get('/api/editor/file', (req, res) => {
  try {
    const full = safePath(req.query.path || '');
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return res.status(404).json({ error: 'فایل پیدا نشد.' });
    const st = fs.statSync(full);
    if (st.size > 2 * 1024 * 1024) return res.status(413).json({ error: 'فایل بزرگ‌تر از ۲ مگابایت است — Code Editor فقط فایل‌های متنی کوچک را نشان می‌دهد.' });
    res.json({ path: req.query.path, content: fs.readFileSync(full, 'utf8') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/editor/file', (req, res) => {
  try {
    const { path: relPath, content } = req.body;
    if (!relPath) return res.status(400).json({ error: 'path لازم است.' });
    const full = safePath(relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content ?? '', 'utf8');
    appendActivity({ type: 'tool_end', tool: 'code_editor', input: { path: relPath }, result: `فایل از Code Editor ذخیره شد: ${relPath}` });
    res.json({ saved: relPath, bytes: Buffer.byteLength(content ?? '', 'utf8') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/editor/new-file', (req, res) => {
  try {
    const { path: relPath } = req.body;
    if (!relPath) return res.status(400).json({ error: 'path لازم است.' });
    const full = safePath(relPath);
    if (fs.existsSync(full)) return res.status(409).json({ error: 'این فایل از قبل وجود دارد.' });
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '', 'utf8');
    res.json({ created: relPath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================================================
// Terminal تعاملی — مستقیم از UI، برای برنامه‌نویس، بدون رفتن از مسیر مدل
// (همون منطق sandbox سبک run_shell: cwd محدود به workspace + timeout؛
// هنوز Container ایزوله‌ی واقعی نیست — این توی README هم صادقانه گفته شده)
// ==================================================
const TERMINAL_TIMEOUT_MS = 25000;

app.post('/api/terminal/run', (req, res) => {
  if (process.env.ALLOW_SHELL === 'false') {
    return res.status(403).json({ error: 'اجرای شل توسط تنظیمات سرور غیرفعال شده (ALLOW_SHELL=false).' });
  }
  const { command, cwd } = req.body;
  if (!command || typeof command !== 'string') return res.status(400).json({ error: 'command لازم است.' });

  let runDir;
  try {
    runDir = safePath(cwd || '.');
  } catch {
    return res.status(400).json({ error: 'cwd خارج از workspace است.' });
  }

  const started = Date.now();
  execFile('bash', ['-c', command], { cwd: runDir, timeout: TERMINAL_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    (err, stdout, stderr) => {
      const ms = Date.now() - started;
      if (err && err.killed) {
        appendActivity({ type: 'terminal', command, ms, code: null, timedOut: true });
        return res.json({ stdout, stderr, code: null, timedOut: true });
      }
      const code = err ? (err.code ?? 1) : 0;
      appendActivity({ type: 'terminal', command, ms, code });
      res.json({ stdout, stderr, code });
    });
});


app.get('/api/health', async (req, res) => {
  const result = {
    ok: true, server: true, time: new Date().toISOString(),
    provider: process.env.AI_PROVIDER || 'openrouter',
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    result.ollama = r.ok;
    if (r.ok) {
      const j = await r.json();
      result.ollamaModels = (j.models || []).map(x => x.name);
    }
  } catch {
    result.ollama = false;
  } finally {
    clearTimeout(timer);
  }
  res.json(result);
});


const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✅ Daniyar AI روی http://127.0.0.1:${PORT} در حال اجراست`);
  console.log(`🌐 WebView/LAN API: http://0.0.0.0:${PORT}`);
});

/* Daniyar AI V4 — mobile-first, resilient frontend */
(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, fallback='') { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } },
    set(k,v) { try { localStorage.setItem(k,v); } catch {} }
  };

  // ToApp/WebView bridge: when the UI is packaged as a local file, relative
  // /api URLs do not point at the Node server. Use a configurable backend base.
  const API_DEFAULT = /^https?:$/i.test(location.protocol)
    ? location.origin
    : 'http://127.0.0.1:3000';
  function getApiBase() {
    let base = store.get('daniyar_api_base', API_DEFAULT).trim();
    if (!base) base = API_DEFAULT;
    return base.replace(/\/+$/, '');
  }
  function isToApp(){ return location.protocol === 'file:' || location.protocol === 'content:' || /ToApp/i.test(navigator.userAgent); }
  async function probeBackend(showToast=false){
    const saved=getApiBase();
    const candidates=[saved,'http://127.0.0.1:3000','http://localhost:3000'];
    const unique=[...new Set(candidates.filter(Boolean))];
    for(const base of unique){
      const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),1800);
      try{
        const r=await fetch(base.replace(/\/+$/,'')+'/api/health',{signal:ctrl.signal,cache:'no-store'});
        if(r.ok){
          store.set('daniyar_api_base',base.replace(/\/+$/,''));
          refreshApiInput(); updateApiUi(true,`اتصال برقرار است · ${base}`);
          return true;
        }
      }catch{} finally{clearTimeout(timer)}
    }
    updateApiUi(false,isToApp()
      ? 'ToApp به Backend وصل نشد. Termux باید سرور را روی پورت 3000 اجرا کند و دسترسی HTTP در WebView مجاز باشد.'
      : `Backend در ${saved} در دسترس نیست.`);
    if(showToast) toast('Backend پیدا نشد؛ آدرس اتصال را در تنظیمات بررسی کن.','error');
    return false;
  }
  function apiUrl(path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${getApiBase()}${p}`;
  }

  const ICONS = {
    grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    spark:'<svg viewBox="0 0 24 24"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
    layout:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 9h12"/></svg>',
    folder:'<svg viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/></svg>',
    file:'<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    code:'<svg viewBox="0 0 24 24"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/></svg>',
    brain:'<svg viewBox="0 0 24 24"><path d="M9 4a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 7.5 14a3.5 3.5 0 0 0 4 5.5V5.5A3 3 0 0 0 9 4ZM15 4a3 3 0 0 1 3 3v.5A3.5 3.5 0 0 1 16.5 14a3.5 3.5 0 0 1-4 5.5V5.5A3 3 0 0 1 15 4Z"/><path d="M6 9h3M15 9h3M7 14h2M15 14h2"/></svg>',
    puzzle:'<svg viewBox="0 0 24 24"><path d="M8.5 4A2.5 2.5 0 1 1 13 6h3.5A1.5 1.5 0 0 1 18 7.5V10a2.5 2.5 0 1 1 0 5v2.5a1.5 1.5 0 0 1-1.5 1.5H14a2.5 2.5 0 1 1-5 0H6.5A1.5 1.5 0 0 1 5 17.5V14a2.5 2.5 0 1 1 0-5V6.5A2.5 2.5 0 0 1 6.5 5h2Z"/></svg>',
    tool:'<svg viewBox="0 0 24 24"><path d="m14.7 6.3 3-3 3 3-3 3M3 21l8.6-8.6M13 5l6 6-4 4-6-6z"/></svg>',
    pulse:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>',
    server:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1 1.2 1.2-1.8 1.8-1.2-1.2-.1.1a7.8 7.8 0 0 1-2 .8V19h-3v-1.2a7.8 7.8 0 0 1-2-.8l-.1-.1-1.2 1.2-1.8-1.8L8.8 15a7.8 7.8 0 0 1-.8-2H6v-3h2a7.8 7.8 0 0 1 .8-2L7.6 6.8l1.8-1.8 1.2 1.2.1-.1a7.8 7.8 0 0 1 2-.8V4h3v1.2a7.8 7.8 0 0 1 2 .8l.1.1 1.2-1.2 1.8 1.8-1.2 1.2.1.1a7.8 7.8 0 0 1 .8 2H22v3h-2a7.8 7.8 0 0 1-.6 2Z"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>',
  };
  $$('[data-icon]').forEach(el => { const n=el.dataset.icon; if(ICONS[n]) el.innerHTML=ICONS[n]; });

  const state = {
    messages: JSON.parse(store.get('daniyar_messages','[]') || '[]'),
    provider: store.get('daniyar_provider','openrouter'),
    model: store.get('daniyar_model','openrouter/free'),
    activeProject: null,
    editorDir: '.',
    editorFile: null,
    toolCatalog: [],
    pluginFilter: 'همه',
  };

  const TITLES = {home:'داشبورد',chat:'گفتگو',studio:'AI Studio',projects:'پروژه‌ها',files:'فایل‌ها',memory:'حافظه',editor:'IDE / Editor',plugins:'Plugin Hub',tools:'ابزارها',activity:'فعالیت',system:'سیستم',settings:'تنظیمات'};

  function escapeHtml(s='') { return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message, kind='info') {
    const el=$('#toast'); if(!el)return; el.textContent=message; el.dataset.kind=kind; el.classList.add('show');
    clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2600);
  }
  async function api(url, opts={}, timeout=6500) {
    const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),timeout);
    try {
      const r=await fetch(apiUrl(url),{...opts,signal:ctrl.signal,headers:{...(opts.headers||{})}});
      const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
      if(!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      return data;
    } finally { clearTimeout(t); }
  }

  function renderText(raw='') {
    const safe=escapeHtml(raw);
    return safe
      .replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .split('\n').map(x=>x.trim()?`<p>${x}</p>`:'<br>').join('');
  }

  function saveChat(){ store.set('daniyar_messages',JSON.stringify(state.messages.slice(-80))); }
  function renderChat(){
    const log=$('#chatLog'); if(!log)return;
    if(!state.messages.length){ log.innerHTML='<div class="empty-chat"><div class="empty-orb">✦</div><h3>چه چیزی می‌سازیم؟</h3><p>کد بنویس، پروژه بررسی کن، فایل تحلیل کن یا فقط سؤال بپرس.</p></div>'; return; }
    log.innerHTML='';
    state.messages.forEach(m=>{const div=document.createElement('div');div.className=`message ${m.role}`;div.innerHTML=m.role==='assistant'?renderText(m.content):escapeHtml(m.content);log.appendChild(div);});
    log.scrollTop=log.scrollHeight;
  }

  function addMessage(role, content){ state.messages.push({role,content}); saveChat(); renderChat(); }

  async function sendMessage(text){
    if(!text?.trim()) return;
    const clean=text.trim(); addMessage('user',clean);
    const log=$('#chatLog'); const typing=document.createElement('div'); typing.className='message assistant typing'; typing.innerHTML='<span></span><span></span><span></span>'; log.appendChild(typing); log.scrollTop=log.scrollHeight;
    $('#sendBtn').disabled=true;
    try{
      const r=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:state.messages,provider:state.provider,model:state.model})},60000);
      // The backend streams SSE, so api() is intentionally not used for chat; this path only remains for non-SSE errors.
      typing.remove();
      if(r?.error) throw new Error(r.error);
    }catch(err){
      typing.remove();
      addMessage('assistant',`خطا: ${err.message}`);
    }finally{$('#sendBtn').disabled=false;}
  }

  async function streamChat(text){
    if(!text?.trim()) return;
    const clean=text.trim(); addMessage('user',clean); $('#sendBtn').disabled=true;
    const log=$('#chatLog');
    const bubble=document.createElement('div'); bubble.className='message assistant'; bubble.innerHTML='';
    const steps=document.createElement('div'); steps.className='agent-steps';
    log.append(bubble,steps); log.scrollTop=log.scrollHeight;
    try{
      const connected=await probeBackend(false);
      if(!connected) throw new Error(isToApp()
        ? 'اتصال به Backend برقرار نشد. در Termux «npm start» را اجرا کن و در تنظیمات آدرس Backend را روی http://127.0.0.1:3000 بگذار.'
        : `Backend در ${getApiBase()} در دسترس نیست.`);
      const resp=await fetch(apiUrl('/api/chat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:state.messages,provider:state.provider,model:state.model})});
      if(!resp.ok){let j={};try{j=await resp.json()}catch{};throw new Error(j.error||`HTTP ${resp.status}`);}
      const reader=resp.body.getReader(), decoder=new TextDecoder(); let buf='',finalText='';
      const renderStep=(s)=>{const d=document.createElement('div');d.className=`agent-step ${s.type||''}`;const icons={thinking:'◌',tool_start:'⚙',tool_end:'✓',final:'✦'};d.innerHTML=`<span>${icons[s.type]||'•'}</span><span>${escapeHtml(s.type==='tool_start'?`اجرای ${s.tool}`:s.type==='tool_end'?`نتیجه ${s.tool}`:s.type==='final'?'پاسخ نهایی':'در حال فکر کردن...')}</span>`;steps.appendChild(d);steps.scrollTop=steps.scrollHeight;};
      while(true){
        const {done,value}=await reader.read(); if(done)break; buf+=decoder.decode(value,{stream:true});
        const chunks=buf.split('\n\n'); buf=chunks.pop()||'';
        for(const chunk of chunks){
          const em=chunk.match(/^event:\s*(.+)$/m), dm=chunk.match(/^data:\s*(.+)$/m); if(!em||!dm)continue;
          let data; try{data=JSON.parse(dm[1])}catch{continue}
          if(em[1]==='step'){renderStep(data); if(data.type==='final'&&data.text)finalText=data.text;}
          if(em[1]==='error') throw new Error(data.message||'خطای Provider');
          if(em[1]==='chunk'){finalText+=data.text||'';}
        }
        if(finalText){bubble.innerHTML=renderText(finalText);log.scrollTop=log.scrollHeight;}
      }
      if(!finalText) finalText='Provider پاسخ متنی برنگرداند.';
      bubble.innerHTML=renderText(finalText); state.messages.push({role:'assistant',content:finalText}); saveChat();
      setTimeout(()=>steps.remove(),1200);
    }catch(err){ bubble.innerHTML=renderText(`خطا: ${err.message}`); toast(err.message,'error'); }
    finally{$('#sendBtn').disabled=false; $('#input')?.focus();}
  }

  async function refreshSession(){
    try{
      const s=await api('/api/session',{},2500); state.activeProject=s.activeProject||null;
      $('#chatProjectName') && ($('#chatProjectName').textContent=state.activeProject||'بدون پروژه');
      $('#activeProjectSettingsLabel') && ($('#activeProjectSettingsLabel').textContent=state.activeProject||'هیچ‌کدام');
      const badge=$('.workspace-pill'); if(badge) badge.classList.toggle('has-project',!!state.activeProject);
    }catch{}
  }

  async function loadDashboard(){
    const [pr,meta,h]=await Promise.allSettled([api('/api/projects'),api('/api/meta'),api('/api/health',{},2500)]);
    const projects=pr.status==='fulfilled'&&Array.isArray(pr.value)?pr.value:[];
    const m=meta.status==='fulfilled'?meta.value:{};
    const health=h.status==='fulfilled'?h.value:{};
    $('#dashProjects').textContent=projects.length.toLocaleString('fa-IR');
    $('#dashTools').textContent=(m.tools||[]).length.toLocaleString('fa-IR');
    $('#dashProvider').textContent=state.provider==='openrouter'?'OpenRouter':state.provider;
    $('#dashModel').textContent=state.model;
    $('#dashProviderState').textContent=health.openrouter?'کلید آماده':state.provider==='ollama'?(health.ollama?'Ollama متصل':'Ollama آفلاین'):'نیازمند کلید';
    $('#footerProvider').textContent=state.provider==='openrouter'?'OpenRouter':state.provider;
    $('#footerModel').textContent=state.model;
    $('#chatModelBadge').textContent=state.model;
    $('#providerInfo').textContent=health.openrouter?'OpenRouter API آماده است.':state.provider==='ollama'?(health.ollama?'Ollama آماده است.':'Ollama در دسترس نیست.'):'Provider به کلید نیاز دارد.';
  }

  function showView(name){
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    $$('.nav-item[data-view], .bottom-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    $('#topbarTitle').textContent=TITLES[name]||name;
    $('#sidebar')?.classList.remove('open');
    if(name==='home')loadDashboard();
    if(name==='projects')loadProjects();
    if(name==='files')loadFiles();
    if(name==='memory')loadMemory();
    if(name==='plugins')loadPlugins();
    if(name==='tools')loadTools();
    if(name==='activity')loadActivity();
    if(name==='system')loadSystem();
    if(name==='editor')loadEditorFiles(state.editorDir);
    if(name==='studio'){loadStudioFiles();loadPlugins();}
  }

  $$('.nav-item[data-view], .bottom-nav [data-view], [data-quick-view]').forEach(b=>b.addEventListener('click',e=>{const n=b.dataset.view||b.dataset.quickView;if(n)showView(n);}));
  $('#sidebarToggle')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));
  $('#mobileMenu')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));
  $('#newChatBtn')?.addEventListener('click',()=>{state.messages=[];saveChat();renderChat();showView('chat');});
  $('#themeToggle')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light'));
  $$('.theme-switch button').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.themeChoice)));

  function applyTheme(theme){document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;store.set('daniyar_theme',theme);$$('.theme-switch button').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===theme));}
  applyTheme(store.get('daniyar_theme','dark'));

  // Backend connection for ToApp/WebView
  const apiInput = $('#apiBaseInput');
  const apiInfo = $('#apiInfo');
  const apiDot = $('#apiDot');
  function updateApiUi(ok, message='') {
    if(apiDot) apiDot.classList.toggle('online', !!ok);
    if(apiInfo) apiInfo.textContent = message || `API: ${getApiBase()}`;
  }
  function refreshApiInput() {
    if(apiInput) apiInput.value = getApiBase();
  }
  async function testApiConnection(showToast=true) {
    try {
      const data = await api('/api/health', {}, 3500);
      updateApiUi(true, `اتصال برقرار است · ${data.provider || 'server'} · ${getApiBase()}`);
      if(showToast) toast('اتصال Backend برقرار است.','success');
      return true;
    } catch(err) {
      updateApiUi(false, `اتصال ناموفق · ${getApiBase()} · ${err.message}`);
      if(showToast) toast(`Backend در دسترس نیست: ${err.message}`,'error');
      return false;
    }
  }
  $('#saveApiBaseBtn')?.addEventListener('click', async () => {
    const value = (apiInput?.value || '').trim().replace(/\/+$/, '');
    if(!/^https?:\/\//i.test(value)) {
      toast('آدرس باید با http:// یا https:// شروع شود.','error'); return;
    }
    store.set('daniyar_api_base', value);
    await testApiConnection(true);
  });
  $('#testApiBtn')?.addEventListener('click', () => testApiConnection(true));
  refreshApiInput();
  setTimeout(()=>probeBackend(false), 900);

  // chat
  $('#chatForm')?.addEventListener('submit',e=>{e.preventDefault();const i=$('#input');const t=i.value;i.value='';streamChat(t);});
  $('#homeForm')?.addEventListener('submit',e=>{e.preventDefault();const i=$('#homeInput');const t=i.value;i.value='';showView('chat');streamChat(t);});
  $('#studioForm')?.addEventListener('submit',e=>{e.preventDefault();const i=$('#studioInput');const t=i.value;i.value='';showView('chat');streamChat(t);});
  $('#input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatForm').requestSubmit();}});
  $('#attachBtn')?.addEventListener('click',()=>$('#attachInput')?.click());
  $('#attachInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const fd=new FormData();fd.append('file',file);try{await api('/api/files/upload',{method:'POST',body:fd});toast('فایل در Workspace قرار گرفت.','success');}catch(err){toast(err.message,'error')}e.target.value='';});
  $('#micBtn')?.addEventListener('click',()=>toast('ورودی صوتی در این نسخه به Speech API مرورگر واگذار شده؛ روی دستگاهی که پشتیبانی می‌کند می‌توانی از میکروفن استفاده کنی.'));

  // projects
  function projectCard(p){return `<button class="project-card" data-project="${escapeHtml(p.name)}"><span class="project-symbol">⌁</span><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.state||'پروژه آماده')}</small></span><em>${(p.decisions?.length||0).toLocaleString('fa-IR')} تصمیم</em></button>`;}
  function drawProjects(el, list){el.innerHTML=list.length?list.map(projectCard).join(''):'<div class="empty-state"><div>⌁</div><h3>هنوز پروژه‌ای نیست</h3><p>اولین پروژه را همین‌جا بساز.</p></div>';$$('[data-project]',el).forEach(c=>c.onclick=async()=>{await api('/api/session/active-project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:c.dataset.project})});refreshSession();showView('chat');});}
  async function loadProjects(){try{const list=await api('/api/projects');drawProjects($('#projectsList'),Array.isArray(list)?list:[]);}catch(e){toast(e.message,'error')}}
  $('#newProjectForm')?.addEventListener('submit',async e=>{e.preventDefault();const i=$('#newProjectName'),n=i.value.trim();if(!n)return;try{await api('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})});i.value='';loadProjects();loadDashboard();toast('پروژه ساخته شد.','success')}catch(err){toast(err.message,'error')}});

  // files
  async function loadFiles(){try{const list=await api('/api/files');const arr=Array.isArray(list)?list:[];$('#fileCount').textContent=`${arr.length.toLocaleString('fa-IR')} مورد`;const el=$('#fileList');el.innerHTML=arr.map(f=>`<div class="file-row"><span class="file-kind">${f.type==='dir'?'DIR':'FILE'}</span><strong>${escapeHtml(f.name)}</strong><small>${f.size==null?'پوشه':(f.size/1024).toFixed(1)+' KB'}</small></div>`).join('')||'<div class="empty-state"><div>⌁</div><h3>Workspace خالی است</h3></div>';}catch(e){toast(e.message,'error')}}
  $('#uploadForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=$('#fileInput').files?.[0];if(!f)return;const fd=new FormData();fd.append('file',f);try{await api('/api/files/upload',{method:'POST',body:fd});toast('آپلود شد.','success');loadFiles();}catch(err){toast(err.message,'error')}});

  // memory
  async function loadMemory(){
    try{const u=await api('/api/memory/user');$('#userMemoryList').innerHTML=(u.facts||[]).map(f=>`<li><span>${escapeHtml(f.text)}</span><button data-delete-memory="${escapeHtml(f.id)}">×</button></li>`).join('')||'<li class="muted">حافظه‌ای ثبت نشده.</li>';$$('[data-delete-memory]').forEach(b=>b.onclick=async()=>{await api(`/api/memory/user/${encodeURIComponent(b.dataset.deleteMemory)}`,{method:'DELETE'});loadMemory();});}catch{}
    try{const p=await api('/api/projects');$('#projectMemorySelect').innerHTML=(p||[]).map(x=>`<option>${escapeHtml(x.name)}</option>`).join('')||'<option>—</option>';}catch{}
    try{const notes=await api('/api/notes');$('#notesList').innerHTML=(notes||[]).map(x=>`<li>${escapeHtml(x.text||x.title||JSON.stringify(x))}</li>`).join('')||'<li class="muted">یادداشتی نیست.</li>';}catch{}
    try{const todos=await api('/api/todos');$('#todosList').innerHTML=(todos||[]).map(x=>`<li>${escapeHtml(x.text||x.title||JSON.stringify(x))}</li>`).join('')||'<li class="muted">کاری نیست.</li>';}catch{}
  }
  $('#userFactForm')?.addEventListener('submit',async e=>{e.preventDefault();const i=$('#userFactInput'),v=i.value.trim();if(!v)return;await api('/api/memory/user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fact:v})});i.value='';loadMemory();});
  $$('.tab').forEach(t=>t.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.add('hidden'));t.classList.add('active');$('#tab-'+t.dataset.tab)?.classList.remove('hidden');}));

  // plugins
  function pluginIcon(p){return ({'کدنویسی':'</>','داده':'◈','وب و شبکه':'◎','سیستم':'⌁','GitHub':'◒','متن':'Aa','طراحی':'◌','امنیت':'◇','فایل':'□','پروژه و حافظه':'◉','رسانه و خروجی':'▶'}[p.category]||p.icon||'✦');}
  function drawPlugins(){
    const search=($('#pluginSearch')?.value||'').trim().toLowerCase();
    const rows=state.toolCatalog.filter(p=>(state.pluginFilter==='همه'||p.category===state.pluginFilter)&&(!search||p.name.toLowerCase().includes(search)||p.description.toLowerCase().includes(search)));
    $('#pluginGrid').innerHTML=rows.map(p=>`<div class="plugin-card"><div class="plugin-mark">${pluginIcon(p)}</div><div class="plugin-info"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.category)}</span><p>${escapeHtml(p.description)}</p></div><button class="plugin-toggle ${p.enabled===false?'off':'on'}" data-plugin-toggle="${escapeHtml(p.name)}">${p.enabled===false?'خاموش':'روشن'}</button></div>`).join('')||'<div class="empty-state"><div>⌁</div><h3>چیزی پیدا نشد</h3></div>';
    $$('[data-plugin-toggle]').forEach(b=>b.onclick=async()=>{const name=b.dataset.pluginToggle;const current=state.toolCatalog.find(x=>x.name===name);b.disabled=true;try{await api('/api/plugins/'+encodeURIComponent(name)+'/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:current?.enabled===false})});toast('وضعیت پلاگین تغییر کرد.','success');await loadPlugins();}catch(e){toast(e.message,'error')}finally{b.disabled=false;}});
  }
  async function loadPlugins(){
    try{
      const c=await api('/api/plugins/catalog');state.toolCatalog=c.plugins||[];
      $('#pluginCount').textContent=(c.totalInstalled||0).toLocaleString('fa-IR');$('#failedCount').textContent=(c.failed?.length||0).toLocaleString('fa-IR');
      const disabled=(await api('/api/plugins').catch(()=>({disabled:[]}))).disabled||[];$('#disabledCount').textContent=(c.disabledCount ?? disabled.length).toLocaleString('fa-IR');
      const cats=['همه',...(c.categories||[])];$('#pluginFilters').innerHTML=cats.map(x=>`<button class="${x===state.pluginFilter?'active':''}" data-filter="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');
      $$('[data-filter]').forEach(b=>b.onclick=()=>{state.pluginFilter=b.dataset.filter;loadPlugins();});
      drawPlugins(); if($('#studioToolCount'))$('#studioToolCount').textContent=String(c.totalInstalled||0);
    }catch(e){toast('Plugin Hub: '+e.message,'error')}
  }
  $('#pluginSearch')?.addEventListener('input',drawPlugins);
  $('#reloadPluginsBtn')?.addEventListener('click',loadPlugins);

  async function loadTools(){try{const c=await api('/api/plugins/catalog');state.toolCatalog=c.plugins||[];$('#toolsList').innerHTML=state.toolCatalog.map(p=>`<div class="plugin-card"><div class="plugin-mark">${pluginIcon(p)}</div><div class="plugin-info"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.category)}</span><p>${escapeHtml(p.description)}</p></div></div>`).join('')}catch{}}

  async function loadActivity(){try{const a=await api('/api/activity');$('#activityList').innerHTML=(a||[]).slice().reverse().slice(0,80).map(x=>`<div class="activity-row"><span class="activity-dot"></span><div><strong>${escapeHtml(x.tool||x.type||'activity')}</strong><small>${escapeHtml(x.result||x.command||'')}</small></div><time>${new Date(x.ts).toLocaleString('fa-IR')}</time></div>`).join('')||'<div class="empty-state">فعالیتی ثبت نشده.</div>'}catch{}}

  async function loadSystem(){try{const [s,h]=await Promise.all([api('/api/system'),api('/api/health',{},2500)]);$('#sysNode').textContent=s.node;$('#sysPlatform').textContent=`${s.platform} · ${s.arch}`;$('#sysUptime').textContent=Math.round(s.uptime)+'s';$('#sysRam').textContent=(s.memory.rss/1024/1024).toFixed(1)+' MB';$('#serviceHealth').innerHTML=`<div class="health-row"><span>Server</span><b class="ok">ONLINE</b></div><div class="health-row"><span>${escapeHtml(h.provider)}</span><b class="${h.openrouter||h.ollama?'ok':'warn'}">${h.openrouter||h.ollama?'READY':'NEEDS CONFIG'}</b></div><div class="health-row"><span>Ollama</span><b class="${h.ollama?'ok':'muted'}">${h.ollama?'ONLINE':'OFFLINE'}</b></div>`;}catch(e){toast(e.message,'error')}}
  $('#refreshSystemBtn')?.addEventListener('click',loadSystem);

  // editor
  async function loadEditorFiles(dir='.'){
    state.editorDir=dir;$('#editorPathLabel').textContent='/'+(dir==='.'?'':dir);
    try{const arr=await api('/api/files?path='+encodeURIComponent(dir));$('#editorFileList').innerHTML=(arr||[]).map(f=>`<button class="editor-file ${f.type==='dir'?'dir':''}" data-entry="${escapeHtml(f.name)}" data-type="${f.type}">${f.type==='dir'?'▣':'•'} ${escapeHtml(f.name)}</button>`).join('')||'<span class="muted">خالی</span>';
    $$('.editor-file').forEach(b=>b.onclick=()=>{const full=state.editorDir==='.'?b.dataset.entry:`${state.editorDir}/${b.dataset.entry}`;b.dataset.type==='dir'?loadEditorFiles(full):openEditorFile(full);});}catch(e){toast(e.message,'error')}
  }
  async function openEditorFile(path){try{const f=await api('/api/editor/file?path='+encodeURIComponent(path));state.editorFile=f.path;$('#editorCurrentFile').textContent=f.path;$('#editorTextarea').value=f.content;$('#editorTextarea').disabled=false;$('#editorSaveBtn').disabled=false;}catch(e){toast(e.message,'error')}}
  $('#editorSaveBtn')?.addEventListener('click',async()=>{try{await api('/api/editor/file',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:state.editorFile,content:$('#editorTextarea').value})});toast('ذخیره شد.','success')}catch(e){toast(e.message,'error')}});
  $('#editorUpBtn')?.addEventListener('click',()=>{const p=state.editorDir.split('/').filter(Boolean);p.pop();loadEditorFiles(p.length?p.join('/') : '.');});
  $('#editorNewFileForm')?.addEventListener('submit',async e=>{e.preventDefault();const n=$('#editorNewFileName').value.trim();if(!n)return;const p=state.editorDir==='.'?n:`${state.editorDir}/${n}`;try{await api('/api/editor/new-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})});$('#editorNewFileName').value='';loadEditorFiles(state.editorDir)}catch(err){toast(err.message,'error')}});
  $('#terminalForm')?.addEventListener('submit',async e=>{e.preventDefault();const i=$('#terminalInput'),cmd=i.value.trim();if(!cmd)return;i.value='';const out=$('#terminalOutput');out.insertAdjacentHTML('beforeend',`<div class="term-cmd">$ ${escapeHtml(cmd)}</div>`);try{const r=await api('/api/terminal/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,cwd:state.editorDir})},30000);out.insertAdjacentHTML('beforeend',`<pre>${escapeHtml((r.stdout||'')+(r.stderr?'\n'+r.stderr:''))}</pre>`)}catch(err){out.insertAdjacentHTML('beforeend',`<pre class="term-error">${escapeHtml(err.message)}</pre>`);}});

  // settings
  $('#providerSelect')?.addEventListener('change',e=>{state.provider=e.target.value;store.set('daniyar_provider',state.provider);loadDashboard();});
  $('#modelInput')?.addEventListener('change',e=>{state.model=e.target.value.trim()||'openrouter/free';store.set('daniyar_model',state.model);loadDashboard();});
  $('#clearActiveProjectBtn')?.addEventListener('click',async()=>{await api('/api/session/active-project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:null})});refreshSession();toast('پروژه فعال پاک شد.','success')});

  // command palette
  const PALETTE=[['داشبورد','home'],['گفتگو','chat'],['AI Studio','studio'],['پروژه‌ها','projects'],['فایل‌ها','files'],['IDE / Editor','editor'],['حافظه','memory'],['Plugin Hub','plugins'],['ابزارها','tools'],['فعالیت','activity'],['سیستم','system'],['تنظیمات','settings']];
  function openPalette(){const b=$('#paletteBackdrop');b.classList.remove('hidden');$('#paletteInput').value='';drawPalette();setTimeout(()=>$('#paletteInput').focus(),20);}
  function closePalette(){$('#paletteBackdrop').classList.add('hidden')}
  function drawPalette(){const q=($('#paletteInput').value||'').toLowerCase();$('#paletteResults').innerHTML=PALETTE.filter(x=>x[0].toLowerCase().includes(q)).map(x=>`<button data-pal="${x[1]}"><span>✦</span>${x[0]}<kbd>↵</kbd></button>`).join('');$$('[data-pal]').forEach(b=>b.onclick=()=>{closePalette();showView(b.dataset.pal)});}
  $('#openPalette')?.addEventListener('click',openPalette);$('#paletteInput')?.addEventListener('input',drawPalette);$('#paletteBackdrop')?.addEventListener('click',e=>{if(e.target.id==='paletteBackdrop')closePalette});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();}if(e.key==='Escape')closePalette();});

  // Micro-interactions: ripple + staggered reveal. Only transform/opacity are animated.
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest('.btn,.icon-button,.command-card,.plugin-toggle,.bottom-nav button,.nav-item');
    if(!b || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r=document.createElement('i'); r.className='ripple'; b.style.position=b.style.position==='static'?'relative':b.style.position;
    const rect=b.getBoundingClientRect(); r.style.left=(e.clientX-rect.left)+'px'; r.style.top=(e.clientY-rect.top)+'px'; b.appendChild(r); setTimeout(()=>r.remove(),700);
  },{passive:true});
  function animateCollections(){
    ['.command-grid','.metric-grid','.project-grid','.plugin-grid','.activity-list','.file-list'].forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.classList.add('motion-stagger')));
  }
  const _showView=showView;
  showView=function(name){_showView(name); requestAnimationFrame(animateCollections)};

  // drag/drop visual polish
  document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('dragging')});
  document.addEventListener('dragleave',e=>{if(e.target===document.body)document.body.classList.remove('dragging')});
  document.addEventListener('drop',async e=>{e.preventDefault();document.body.classList.remove('dragging');const f=e.dataTransfer?.files?.[0];if(!f)return;const fd=new FormData();fd.append('file',f);try{await api('/api/files/upload',{method:'POST',body:fd});toast('فایل در Workspace قرار گرفت.','success');loadFiles()}catch(err){toast(err.message,'error')}});

  // PWA
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}

  // first paint is synchronous; network work is non-blocking.
  $('#providerSelect').value=state.provider;$('#modelInput').value=state.model;renderChat();refreshSession();loadDashboard();if($('#recentProjects')) loadRecentProjects();
  async function loadRecentProjects(){try{const p=await api('/api/projects');drawProjects($('#recentProjects'),(p||[]).slice(-6).reverse());}catch{}}
  // Do not block first paint; silently verify the configured backend after the UI is ready.
  setTimeout(() => testApiConnection(false), 700);
})();

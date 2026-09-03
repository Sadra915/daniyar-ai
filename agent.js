// agent.js — Daniyar V4 agent loop with provider adapters and real tool calling.
const fs = require('fs');
const path = require('path');
const { loadPlugins } = require('./plugin-loader');
const memoryManager = require('./memory-manager');
const { providerName, anthropicChat, runOpenAICompatAgentTurn } = require('./llm-client');

const MODEL = process.env.DANIYAR_MODEL || process.env.OPENROUTER_MODEL || 'openrouter/free';
const MAX_TURNS = 12;
const PERSONA_PATH = path.join(__dirname, 'prompts', 'daniyar-persona.md');

function buildSystemPrompt(availableTools) {
  const persona = fs.readFileSync(PERSONA_PATH, 'utf8');
  const toolList = availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
  const userMem = memoryManager.getUserMemory();
  const userFactsBlock = userMem.facts?.length
    ? `## حافظه کاربر\n${userMem.facts.map(f => `- ${f.text}`).join('\n')}` : '';
  const session = memoryManager.getSession();
  let projectBlock = '';
  if (session.activeProject) {
    const proj = memoryManager.getProjectMemory(session.activeProject);
    const decisions = proj.decisions?.length ? proj.decisions.map(d => `- ${d.text}`).join('\n') : '(هنوز چیزی ثبت نشده)';
    projectBlock = `## پروژه فعال «${proj.name}»\nمعماری: ${proj.architecture || '(ثبت نشده)'}\nوضعیت: ${proj.state || '(ثبت نشده)'}\nتصمیمات:\n${decisions}`;
  }
  return [
    persona,
    `## ابزارهای فعال و واقعی\n${toolList}`,
    `## سیاست اجرا\nهرگز وانمود نکن که ابزاری را اجرا کرده‌ای. برای کارهای خطرناک یا مخرب بدون تأیید صریح اقدام نکن. در کارهای برنامه‌نویسی اول وضعیت پروژه را بررسی کن و بعد تغییر بده.`,
    userFactsBlock, projectBlock
  ].filter(Boolean).join('\n\n');
}

async function runAgent({ messages, onStep, model, provider }) {
  const { tools, handlers } = loadPlugins();
  const system = buildSystemPrompt(tools);
  const selectedProvider = providerName(provider);
  const conversation = JSON.parse(JSON.stringify(messages || []));
  let finalText = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    onStep?.({ type:'thinking', turn, provider:selectedProvider, model:model || MODEL });

    if (selectedProvider === 'anthropic') {
      const result = await anthropicChat({ messages:conversation, tools, system, model:model || MODEL });
      finalText = result.text;
      if (!result.toolUses.length) {
        onStep?.({ type:'final', text:finalText, activeProject:memoryManager.getSession().activeProject });
        return finalText;
      }
      conversation.push({ role:'assistant', content: result.response.content });
      const results = [];
      for (const use of result.toolUses) {
        const entry = handlers[use.name];
        onStep?.({ type:'tool_start', tool:use.name, input:use.input, permission:entry?.permission || 'unknown' });
        let out;
        try { if (!entry) throw new Error(`ابزار ناشناخته: ${use.name}`); out = await entry.handler(use.input || {}); }
        catch (err) { out = `خطا در اجرای ابزار: ${err.message}`; }
        onStep?.({ type:'tool_end', tool:use.name, result:out });
        results.push({ type:'tool_result', tool_use_id:use.id, content:String(out).slice(0,8000) });
      }
      conversation.push({ role:'user', content:results });
      continue;
    }

    const result = await runOpenAICompatAgentTurn({
      messages:conversation, tools, system, model:model || MODEL, provider:selectedProvider
    });
    finalText = result.text || '';
    if (!result.toolCalls.length) {
      onStep?.({ type:'final', text:finalText, activeProject:memoryManager.getSession().activeProject, usage:result.usage });
      return finalText;
    }

    // OpenAI-compatible tool call history.
    conversation.push(result.rawMessage);
    for (const call of result.toolCalls) {
      const fn = call.function || {};
      let args = {};
      try { args = fn.arguments ? JSON.parse(fn.arguments) : {}; } catch {}
      const entry = handlers[fn.name];
      onStep?.({ type:'tool_start', tool:fn.name, input:args, permission:entry?.permission || 'unknown' });
      let out;
      try { if (!entry) throw new Error(`ابزار ناشناخته: ${fn.name}`); out = await entry.handler(args); }
      catch (err) { out = `خطا در اجرای ابزار: ${err.message}`; }
      onStep?.({ type:'tool_end', tool:fn.name, result:out });
      conversation.push({ role:'tool', tool_call_id:call.id, content:String(out).slice(0,8000) });
    }
  }

  onStep?.({ type:'final', text:finalText || 'به سقف مراحل مجاز رسیدم؛ درخواست را مرحله‌ای‌تر کن.' });
  return finalText;
}

module.exports = { runAgent, MODEL };

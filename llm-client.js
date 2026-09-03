// llm-client.js — unified provider layer for Daniyar AI V4.
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

function providerName(provider) {
  return (provider || process.env.AI_PROVIDER || 'openrouter').toLowerCase();
}

function toOpenRouterTools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.input_schema || { type: 'object', properties: {} },
    },
  }));
}

function normalizeMessages(messages) {
  return (messages || []).map((m) => {
    if (!m || !m.role) return m;
    if (Array.isArray(m.content)) {
      // Anthropic-style history -> keep only compatible text for OpenRouter unless tool messages.
      const hasTool = m.content.some((x) => x && (x.type === 'tool_use' || x.type === 'tool_result'));
      if (!hasTool) return { role: m.role, content: m.content.map((x) => x.text || '').join('') };
    }
    return m;
  });
}

async function openRouterChat({ messages, tools, system, model, stream = false, signal }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY تنظیم نشده. فایل .env را تنظیم کنید.');

  const payload = {
    model: model || DEFAULT_OPENROUTER_MODEL,
    messages: system ? [{ role: 'system', content: system }, ...normalizeMessages(messages)] : normalizeMessages(messages),
    stream,
  };
  if (tools?.length) payload.tools = toOpenRouterTools(tools);
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
      ...(process.env.OPENROUTER_SITE_NAME ? { 'X-Title': process.env.OPENROUTER_SITE_NAME } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`OpenRouter HTTP ${r.status}: ${body.slice(0, 800)}`);
  }
  return r;
}

async function ollamaChat({ messages, tools, system, model, stream = false, signal }) {
  const base = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const payload = {
    model: model || process.env.OLLAMA_MODEL || 'llama3.2',
    messages: system ? [{ role:'system', content:system }, ...normalizeMessages(messages)] : normalizeMessages(messages),
    stream,
  };
  if (tools?.length) payload.tools = toOpenRouterTools(tools);
  const r = await fetch(`${base}/api/chat`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    signal,
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${await r.text()}`);
  return r;
}

function parseAnthropicContent(response) {
  const toolUses = response.content.filter((b) => b.type === 'tool_use');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return { text, toolUses };
}

async function anthropicChat({ messages, tools, system, model }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY تنظیم نشده.');
  const client = new Anthropic({ apiKey:key });
  const response = await client.messages.create({
    model: model || process.env.DANIYAR_MODEL || 'claude-sonnet-5',
    max_tokens: 4096,
    system,
    messages,
    tools,
  });
  return { provider:'anthropic', response, ...parseAnthropicContent(response) };
}

async function runOpenAICompatAgentTurn({ messages, tools, system, model, provider, signal }) {
  const response = provider === 'ollama'
    ? await ollamaChat({ messages, tools, system, model, stream:false, signal })
    : await openRouterChat({ messages, tools, system, model, stream:false, signal });
  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('پاسخ نامعتبر از Provider دریافت شد.');
  const content = choice.message?.content || '';
  const toolCalls = choice.message?.tool_calls || [];
  return { text: content, toolCalls, rawMessage: choice.message, usage: data.usage || null };
}

module.exports = {
  providerName,
  toOpenRouterTools,
  openRouterChat,
  ollamaChat,
  anthropicChat,
  runOpenAICompatAgentTurn,
  DEFAULT_OPENROUTER_MODEL,
};

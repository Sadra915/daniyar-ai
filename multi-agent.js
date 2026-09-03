// multi-agent.js — provider-agnostic specialized sub-agents.
const fs = require('fs');
const path = require('path');
const { loadPlugins } = require('./plugin-loader');
const { providerName, anthropicChat, runOpenAICompatAgentTurn } = require('./llm-client');

const MODEL = process.env.DANIYAR_MODEL || process.env.OPENROUTER_MODEL || 'openrouter/free';
const MAX_SUB_TURNS = 8;
const ROLES = {
  backend:{label:'Backend Agent',goal:'پیاده‌سازی و اصلاح منطق سمت سرور، API و منطق تجاری.',tools:['read_file','write_file','edit_file','write_files','list_files','search_code','run_shell','install_package','analyze_project','run_build_test']},
  frontend:{label:'Frontend Agent',goal:'طراحی و پیاده‌سازی رابط کاربری، accessibility و performance.',tools:['read_file','write_file','edit_file','write_files','list_files','search_code','preview_project']},
  database:{label:'Database Agent',goal:'بررسی دیتابیس و پیشنهادهای واقعی برای schema/query/index.',tools:['db_lab','read_file','write_file','analyze_project']},
  testing:{label:'Testing Agent',goal:'نوشتن و اجرای تست، build و lint با گزارش واقعی.',tools:['run_build_test','run_lint','read_file','write_file','list_files','search_code']},
  security:{label:'Security Agent',goal:'شناسایی الگوهای پرخطر و مشکلات امنیتی رایج در کد.',tools:['search_code','run_lint','read_file','list_files']},
  devops:{label:'DevOps Agent',goal:'مدیریت dependency، build/deploy محلی، Git و بسته‌بندی خروجی.',tools:['run_shell','install_package','git_local','export_project','zip_files','run_sandboxed']},
  docs:{label:'Documentation Agent',goal:'نگارش README و مستندات دقیق و قابل‌اجرا.',tools:['read_file','write_file','edit_file','list_files','read_document']},
  architect:{label:'Architect',goal:'تحلیل معماری و پیشنهاد ساختاری بدون تغییر مستقیم کد.',tools:['read_file','list_files','analyze_project','search_code','project_memory']},
};
function subSystem(role, task, tools){
  return `تو ${ROLES[role].label} در Daniyar V4 هستی.
هدف: ${ROLES[role].goal}
کار: ${task}
ابزارهای مجاز:
${tools.map(x=>`- ${x.name}: ${x.description}`).join('\n')}
فقط روی همین کار تمرکز کن. هیچ عملیات انجام‌نشده‌ای را انجام‌شده اعلام نکن.`;
}
async function runSubAgent({role,task,onStep,provider,model}){
  if(!ROLES[role])return{summary:`نقش نامعتبر: ${role}`,steps:[]};
  const all=loadPlugins(), allowed=new Set(ROLES[role].tools), tools=all.tools.filter(t=>allowed.has(t.name)), handlers=all.handlers;
  const selected=providerName(provider), history=[{role:'user',content:task}], steps=[];let finalText='';
  for(let turn=0;turn<MAX_SUB_TURNS;turn++){
    const system=subSystem(role,task,tools);
    if(selected==='anthropic'){
      const r=await anthropicChat({messages:history,tools,system,model:model||MODEL});
      finalText=r.text||''; if(!r.toolUses.length)break;
      history.push({role:'assistant',content:r.response.content});
      const results=[];
      for(const use of r.toolUses){const entry=handlers[use.name];onStep?.({type:'sub_tool_start',role,tool:use.name,input:use.input});let out;try{if(!entry)throw new Error(`ابزار خارج از دسترس: ${use.name}`);out=await entry.handler(use.input||{})}catch(e){out=`خطا: ${e.message}`};onStep?.({type:'sub_tool_end',role,tool:use.name,result:out});steps.push(use.name);results.push({type:'tool_result',tool_use_id:use.id,content:String(out).slice(0,6000)});}
      history.push({role:'user',content:results});
    } else {
      const r=await runOpenAICompatAgentTurn({messages:history,tools,system,model:model||MODEL,provider:selected});
      finalText=r.text||''; if(!r.toolCalls.length)break;
      history.push(r.rawMessage);
      for(const call of r.toolCalls){const fn=call.function||{};let args={};try{args=fn.arguments?JSON.parse(fn.arguments):{}}catch{};const entry=handlers[fn.name];onStep?.({type:'sub_tool_start',role,tool:fn.name,input:args});let out;try{if(!entry)throw new Error(`ابزار خارج از دسترس: ${fn.name}`);out=await entry.handler(args)}catch(e){out=`خطا: ${e.message}`};onStep?.({type:'sub_tool_end',role,tool:fn.name,result:out});steps.push(fn.name);history.push({role:'tool',tool_call_id:call.id,content:String(out).slice(0,6000)});}
    }
  }
  return {summary:finalText||'(به سقف مراحل رسید)',steps};
}
module.exports={runSubAgent,ROLES};
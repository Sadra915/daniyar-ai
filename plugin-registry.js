const fs = require('fs');
const path = require('path');
const { loadPlugins } = require('./plugin-loader');

const REGISTRY = path.join(__dirname, 'memory', 'plugin-registry.json');
const DIR = path.join(__dirname, 'plugins');

function read(){ try{return JSON.parse(fs.readFileSync(REGISTRY,'utf8'));}catch{return {disabled:[],installed:[]};} }
function write(x){fs.mkdirSync(path.dirname(REGISTRY),{recursive:true});fs.writeFileSync(REGISTRY,JSON.stringify(x,null,2));}

function list(){
  const r=read(), disabled=new Set(r.disabled||[]);
  const active=loadPlugins();
  const modules=[];
  for(const file of fs.readdirSync(DIR).filter(f=>f.endsWith('.js')&&!f.startsWith('_'))){
    try{
      const mod=require(path.join(DIR,file));
      if(!mod?.name||!mod?.handler) continue;
      modules.push({
        name:mod.name, description:mod.description||'', permission:mod.permission||'green', category:mod.category||'عمومی', icon:mod.icon||'✦', version:mod.version||'1.0.0',
        enabled:!disabled.has(mod.name), builtin:true, file
      });
    }catch(err){ /* surfaced via failed */ }
  }
  return {
    plugins:modules,
    failed:active.failed||[],
    disabled:[...disabled],
    activeCount:active.tools.length,
    installedCount:modules.length
  };
}
function setEnabled(name, enabled){
  const r=read();r.disabled=r.disabled||[];
  r.disabled=enabled?r.disabled.filter(x=>x!==name):Array.from(new Set([...r.disabled,name]));
  write(r);return list();
}
module.exports={list,setEnabled};

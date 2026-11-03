import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

// 합성 hook host: 브라우저/React rendering 인수 대신 실제 JSX 이벤트와 API payload를 실행한다.
// 실제 React/브라우저 수명주기는 후속 브라우저 QA에서 별도 확인한다.
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
function loadModule(relative, overrides = {}, cache = new Map()) {
  const path = resolve(root, relative);
  assert.ok(existsSync(path), `implementation missing: ${relative}`);
  if (cache.has(path)) return cache.get(path).exports;
  const module = {exports: {}};
  cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const localRequire = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(path), name);
    const found = ['.ts','.tsx',''].map(ext => base + ext).find(existsSync);
    assert.ok(found, `module missing: ${name}`);
    return loadModule(found, overrides, cache);
  };
  new Function('require','module','exports',code)(localRequire,module,module.exports);
  return module.exports;
}
const flatten = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[].concat(tree.props?.children ?? []).flat(Infinity).flatMap(flatten)];
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : [].concat(tree?.props?.children ?? []).flat(Infinity).map(text).join('');
const flush = async () => { for(let i=0;i<12;i++) await new Promise(resolve => setImmediate(resolve)); };

function hookHost() {
  const slots=[]; let index=0; const pending=[];
  return { reset: () => {index=0;}, effects: () => pending.splice(0).forEach(fn=>fn()),
    react: {
      useState(initial) {const at=index++; if(!(at in slots)) slots[at]=typeof initial==='function'?initial():initial; return [slots[at], next => {slots[at]=typeof next==='function'?next(slots[at]):next;}];},
      useRef(initial) {const at=index++; if(!(at in slots)) slots[at]={current:initial}; return slots[at];},
      useEffect(fn,deps) {const at=index++; const before=slots[at]; if(!before || deps.some((v,i)=>v!==before[i])) {slots[at]=deps;pending.push(fn);}},
    },
  };
}

test('connection payloads omit blanks and never mutate the input credential draft', () => {
  const api=loadModule('lib/channel-connections-api.ts', {'@/lib/auth':{redirectToLogin(){}}});
  const draft={name:' QA ',bot_id:'bot',installation_id:'i',account_id:'a',target_id:'t'};
  const credentials={bot_token:'synthetic-sensitive',app_token:' '};
  assert.deepEqual(api.buildConnectionPayload(draft,credentials), {...draft,name:'QA',credentials:{bot_token:'synthetic-sensitive'}});
  assert.deepEqual(api.buildConnectionPayload(draft,{bot_token:''}), {...draft,name:'QA'});
  assert.equal(credentials.app_token,' ');
});

test('seven-language catalogs resolve safe localized errors and provider field choices', () => {
  const {CONNECTION_COPY,connectionErrorMessage}=loadModule('lib/i18n/channel-connections.ts');
  const api=loadModule('lib/channel-connections-api.ts', {'@/lib/auth':{redirectToLogin(){}}});
  assert.deepEqual(api.credentialFieldsForProvider('TEAMS'),['client_id','client_secret','tenant_id']);
  assert.deepEqual(api.credentialFieldsForProvider('google-chat'),['service_account_json','project_id']);
  assert.deepEqual(api.credentialFieldsForProvider('webchat'),[]);
  for(const lang of ['ko','en','zh-CN','ja','vi','fr','de']) {
    const copy=CONNECTION_COPY[lang];
    for(const key of Object.keys(CONNECTION_COPY.ko)) assert.ok(copy[key]?.trim(),`${lang}/${key}`);
    assert.equal(connectionErrorMessage(new Error('CONNECTION_KEY_UNAVAILABLE: synthetic-sensitive'),copy),copy.keyUnavailable);
    assert.equal(connectionErrorMessage(new Error('CONNECTION_WORKER_UNAVAILABLE'),copy),copy.pending);
    assert.equal(connectionErrorMessage(new Error('synthetic-sensitive'),copy),copy.error);
  }
});

test('panel events load, add, save, edit, check, connect error, disconnect, delete and close without browser storage', async t => {
  const host=hookHost();
  const copy=loadModule('lib/i18n/channel-connections.ts').CONNECTION_COPY.en;
  let rows=[]; const requests=[];
  const saved={id:'connection',channel_id:'parent',bot_id:'bot',name:'QA',provider:'slack',installation_id:'i',account_id:'a',target_id:'t',desired_state:'disconnected',observed_state:'disconnected',generation:1,credentials_registered:true,identity_verified:false,last_error_code:null,last_checked_at:null};
  t.mock.method(globalThis,'fetch',async (url,init)=>{
    requests.push({url,init}); const method=init.method??'GET';
    if(String(url).endsWith('/connect')) return new Response(JSON.stringify({detail:'CONNECTION_WORKER_UNAVAILABLE'}),{status:409});
    if(method==='POST' && String(url).endsWith('/connections')) rows=[saved];
    if(method==='DELETE') rows=[];
    return new Response(JSON.stringify({data:method==='GET'?{items:rows,bots:[{id:'bot',name:'Answer bot'}],total:rows.length}:saved}));
  });
  let closed=0;
  // Secret을 storage에 기록하면 실패. 실제 JSX 이벤트와 실제 API client를 사용한다.
  const forbidden = new Proxy({}, {get(){assert.fail('credential browser persistence forbidden');}});
  const beforeWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{confirm:()=>true,localStorage:forbidden,sessionStorage:forbidden}});
  t.after(()=>{if(beforeWindow) Object.defineProperty(globalThis,'window',beforeWindow); else delete globalThis.window;});
  const {ChannelConnectionsPanel}=loadModule('components/channel-connections-panel.tsx',{
    react:host.react,'@/lib/auth':{redirectToLogin(){}},
  });
  const props={token:'synthetic-session',language:'en',channel:{id:'parent',name:'Slack',data_json:{provider:'slack'}},onClose:()=>{closed++;}};
  let tree;
  const render=()=>{host.reset();tree=ChannelConnectionsPanel(props);host.effects();return tree;};
  const button=label=>flatten(tree).find(n=>n.type==='button' && text(n)===label);
  const input=name=>flatten(tree).find(n=>(n.type==='input'||n.type==='select') && n.props.name===name);
  render(); await flush();render();
  assert.ok(text(tree).includes(copy.empty));
  button(copy.add).props.onClick();render();
  for(const [key,value] of Object.entries({name:'QA',bot_id:'bot',installation_id:'i',account_id:'a',target_id:'t',bot_token:'synthetic-sensitive',app_token:'synthetic-app'})) {
    input(key).props.onChange({target:{value}});render();
  }
  assert.equal(input('bot_token').props.type,'password');
  await flatten(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render();
  assert.ok(text(tree).includes('QA'));
  assert.equal(flatten(tree).filter(n=>n.type==='form').length,0);
  const posted=requests.find(r=>r.init.method==='POST'&&r.url.endsWith('/connections'));
  assert.equal(JSON.parse(posted.init.body).credentials.bot_token,'synthetic-sensitive');
  button(copy.edit).props.onClick();render();
  assert.equal(input('bot_token').props.value,'');
  await flatten(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});render();
  assert.equal(JSON.parse(requests.find(r=>r.init.method==='PATCH').init.body).credentials,undefined);
  await button(copy.check).props.onClick();render(); assert.ok(text(tree).includes(copy.configOk));
  await button(copy.connect).props.onClick();render();
  assert.equal(text(flatten(tree).find(n=>n.props?.role==='alert')),copy.pending);
  await button(copy.disconnect).props.onClick();render();
  await button(copy.remove).props.onClick();render(); assert.ok(text(tree).includes(copy.empty));
  button(copy.close).props.onClick();assert.equal(closed,1);
  assert.ok(requests.some(r=>r.url.endsWith('/disconnect')));
  assert.ok(requests.some(r=>r.init.method==='DELETE'));
});

test('provider aliases retain the eight Admin/DB/runtime mappings', async () => {
  const {normalizeChannelProvider, runtimeChannelForProvider} = await import('../../../packages/shared/src/channel-provider-map.ts');
  for (const [admin, db, runtime] of [
    ['WEBCHAT','webchat','webchat'], ['KAKAO','kakao','kakao'], ['TEAMS','ms_teams','ms-teams'],
    ['SLACK','slack','slack'], ['DISCORD','discord','discord'], ['TELEGRAM','telegram','telegram'],
    ['GOOGLE_CHAT','google_chat','google-chat'], ['LINE','line','line'],
  ]) {
    for (const alias of [admin,db,runtime]) {
      assert.equal(normalizeChannelProvider(alias),db);
      assert.equal(runtimeChannelForProvider(normalizeChannelProvider(alias)),runtime);
    }
  }
  for (const invalid of ['teams','MS_TEAMS','googlechat','',null,{},' slack ']) {
    assert.throws(() => normalizeChannelProvider(invalid));
  }
});

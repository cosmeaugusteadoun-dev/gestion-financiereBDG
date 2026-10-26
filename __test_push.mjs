import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import {createPushHandler,compterAnniversaires,abonnementValide} from "./supabase/functions/push-notifications/core.mjs";
let tests=0;async function test(label,fn){await fn();tests++;console.log("OK "+label);}
const subscription={endpoint:"https://fcm.googleapis.com/fcm/send/device",keys:{p256dh:"A".repeat(87),auth:"B".repeat(22)}};
const owner="11111111-1111-4111-8111-111111111111";
const baseEnv={SUPABASE_URL:"https://projet.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"service-secret",PUSH_VAPID_PUBLIC_KEY:"public-push",PUSH_VAPID_PRIVATE_KEY:"private-push",PUSH_VAPID_SUBJECT:"https://ecole.example",PUSH_CRON_SECRET:"cron-secret",PUSH_ADMIN_USER_IDS:owner,PUSH_ALLOWED_ORIGINS:"https://ecole.example"};
function harness(){
 const state={subs:[],deliveries:[],enfants:[{id:"e1",ddn:"2020-10-26"},{id:"e2",ddn:"2021-10-27"}],calls:[],sends:0,user:owner,sendError:null,failLedger:false};
 const fakeFetch=async(url,options={})=>{
  const u=new URL(url);state.calls.push({path:u.pathname,method:options.method||"GET"});
  if(u.pathname==="/auth/v1/user")return new Response(JSON.stringify({id:state.user}),{status:options.headers.Authorization==="Bearer valid"?200:401});
  const table=u.pathname.split("/").pop();let arr=table==="push_subscriptions"?state.subs:table==="push_deliveries"?state.deliveries:state.enfants;
  const filter=row=>[...u.searchParams].every(([key,val])=>{
   if(["select","limit","offset","order"].includes(key))return true;
   if(val.startsWith("eq."))return String(row[key])===val.slice(3);
   if(val.startsWith("gt."))return String(row[key])>val.slice(3);
   if(val==="not.is.null")return row[key]!=null;return true;
  });
  const method=options.method||"GET";
  if(method==="GET"){const rows=arr.filter(filter),offset=Number(u.searchParams.get("offset")||0),limit=Number(u.searchParams.get("limit")||1000);return Response.json(rows.slice(offset,offset+limit));}
  const values=JSON.parse(options.body);
  if(method==="POST"){
   if(table==="push_deliveries"&&state.failLedger)return Response.json({code:"FAIL"},{status:503});
   const duplicate=table==="push_subscriptions"?arr.some(r=>r.id===values.id):arr.some(r=>r.subscription_id===values.subscription_id&&r.on_date===values.on_date);
   if(duplicate)return Response.json({code:"23505"},{status:409});
   arr.push(values);return new Response(null,{status:201});
  }
  if(method==="PATCH"){arr.filter(filter).forEach(r=>Object.assign(r,values));return new Response(null,{status:204});}
  throw new Error("Unexpected fetch");
 };
 const handler=createPushHandler({env:k=>baseEnv[k],fetch:fakeFetch,crypto:webcrypto,now:()=>new Date("2026-10-26T06:00:00Z"),sendPush:async(sub,payload,ttl)=>{state.sends++;state.payload=JSON.parse(payload);assert.ok(ttl>0&&ttl<=86400);if(state.sendError)throw state.sendError;}});
 const call=(action,body={},headers={})=>handler(new Request("https://edge.example",{method:"POST",headers:{origin:"https://ecole.example",authorization:"Bearer valid","content-type":"application/json",...headers},body:JSON.stringify({action,...body})}));
 return {state,call};
}
await test("anniversaires : fuseau Benin, doublons, date invalide et 29 fevrier",()=>{
 assert.equal(compterAnniversaires([{id:"a",ddn:"2020-10-27"},{id:"a",ddn:"2020-10-27"},{id:"b",ddn:"2090-10-27"}],new Date("2026-10-26T23:00:00Z")),1);
 assert.equal(compterAnniversaires([{id:"f",ddn:"2020-02-29"},{id:"x",ddn:"2023-02-29"}],new Date("2027-03-01T06:00:00Z")),1);
});
await test("abonnements : refuse adresses privees, HTTP, identifiants URL et faux domaines",()=>{
 assert.equal(abonnementValide(subscription),true);
 for(const endpoint of ["https://127.0.0.1/test","http://fcm.googleapis.com/test","https://fcm.googleapis.com.evil.example/test","https://a:b@fcm.googleapis.com/test"])
 assert.equal(abonnementValide({...subscription,endpoint}),false);
});
await test("configuration : authentification reelle et liste autorisee",async()=>{
 const h=harness();assert.equal((await h.call("config",{}, {authorization:"Bearer fake"})).status,401);
 h.state.user="inconnu";assert.equal((await h.call("config")).status,403);
 assert.equal(h.state.sends,0);
});
await test("configuration : cle publique uniquement, aucun secret prive",async()=>{
 const h=harness(),r=await (await h.call("config")).text();
 assert.ok(r.includes("public-push"));assert.ok(!r.includes("private-push"));assert.ok(!r.includes("cron-secret"));
});
await test("abonnement, reactivation et desactivation reserves au proprietaire",async()=>{
 const h=harness();assert.equal((await h.call("subscribe",{subscription})).status,200);assert.equal(h.state.subs.length,1);
 await h.call("subscribe",{subscription});assert.equal(h.state.subs.length,1);
 await h.call("unsubscribe",{subscription});assert.equal(h.state.subs[0].active,false);
});
await test("un compte autorise ne peut pas reprendre un appareil d'un autre compte",async()=>{
 const h=harness();await h.call("subscribe",{subscription});h.state.subs[0].owner_id="autre";
 assert.equal((await h.call("subscribe",{subscription})).status,403);
});
await test("planification : secret prive obligatoire, meme pour un admin connecte",async()=>{
 const h=harness();assert.equal((await h.call("daily")).status,401);assert.equal((await h.call("daily",{},{"x-push-cron-secret":"faux"})).status,401);assert.equal(h.state.sends,0);
});
await test("anniversaire : un push par appareil et par date, jamais aux parents",async()=>{
 const h=harness();await h.call("subscribe",{subscription});
 await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});
 assert.equal(h.state.sends,1);assert.equal(h.state.payload.count,1);assert.equal(h.state.payload.date,"2026-10-26");
 assert.ok(!JSON.stringify(h.state.payload).includes("2020-10-26"));assert.equal(h.state.deliveries[0].status,"accepted");
});
await test("aucun anniversaire : aucun envoi",async()=>{
 const h=harness();await h.call("subscribe",{subscription});h.state.enfants=[];
 await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});assert.equal(h.state.sends,0);
});
await test("anniversaires deja consultes aujourd'hui : pas de rappel",async()=>{
 const h=harness();await h.call("subscribe",{subscription});await h.call("ack",{subscription});
 await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});assert.equal(h.state.sends,0);
});
await test("journal indisponible : aucun envoi sans prevention des doublons",async()=>{
 const h=harness();await h.call("subscribe",{subscription});h.state.failLedger=true;
 assert.equal((await h.call("daily",{},{"x-push-cron-secret":"cron-secret"})).status,503);assert.equal(h.state.sends,0);
});
await test("reponse perdue : aucun renvoi automatique du push incertain",async()=>{
 const h=harness();await h.call("subscribe",{subscription});h.state.sendError=new Error("network");
 await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});
 assert.equal(h.state.sends,1);assert.equal(h.state.deliveries[0].status,"unknown");
});
await test("abonnement expire : desactivation, pas de boucle d'envoi",async()=>{
 const h=harness();await h.call("subscribe",{subscription});h.state.sendError={statusCode:410};
 await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});assert.equal(h.state.subs[0].active,false);
});
await test("pagination : tous les appareils traites meme apres suppressions d'abonnements expires",async()=>{
 const h=harness();for(let i=0;i<105;i++)h.state.subs.push({id:String(i).padStart(64,"0"),owner_id:owner,active:true,vapid_public_key:"public-push",subscription});
 h.state.sendError={statusCode:410};await h.call("daily",{},{"x-push-cron-secret":"cron-secret"});assert.equal(h.state.sends,105);
});
await test("service worker : notification visible, badge et ouverture du tableau de bord",async()=>{
 const handlers={},shown=[],badges=[];let stored=null,opened;
 const current=new Date("2026-10-26T07:00:00Z");
 const self={registration:{scope:"https://ecole.example/",showNotification:async(t,o)=>shown.push(o)},navigator:{setAppBadge:async n=>badges.push(n),clearAppBadge:async()=>badges.push(0)},clients:{matchAll:async()=>[],openWindow:async u=>{opened=u;}},addEventListener:(t,f)=>handlers[t]=f};
 const caches={open:async()=>({put:async(_k,v)=>{stored=await v.json();},match:async()=>stored?Response.json(stored):undefined})};
 const c=vm.createContext({self,caches,URL,Response,Intl,Date:class extends Date{constructor(...a){super(...(a.length?a:[current]));}}});
 vm.runInContext(fs.readFileSync("sw.js","utf8"),c);
 let pending;handlers.push({data:{json:()=>({type:"anniversaires",date:"2026-10-26",count:2})},waitUntil:p=>pending=p});await pending;
 assert.equal(shown.length,1);assert.equal(badges.at(-1),2);
 handlers.notificationclick({notification:{close(){}},waitUntil:p=>pending=p});await pending;assert.ok(opened.endsWith("app.html?notifications=anniversaires"));
 handlers.message({data:{type:"BDJ_BIRTHDAY_READ",date:"2026-10-26",count:2},waitUntil:p=>pending=p});await pending;assert.equal(stored.count,2);assert.equal(badges.at(-1),0);
});

await test("interface : aucune demande automatique, activation par geste et aucune notification aux parents",async()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:"",disabled:false,listeners:{},addEventListener(t,f){this.listeners[t]=f;}});return nodes.get(id);};
 let permissions=0,subscriptions=0,calls=[];
 const sub={toJSON:()=>subscription};
 const reg={pushManager:{getSubscription:async()=>null,subscribe:async()=>{subscriptions++;return sub;}}};
 const c=vm.createContext({console,URLSearchParams,Uint8Array,AbortSignal,atob,Date,
  window:{PushManager:function(){},Notification:{},SUPABASE_URL:"https://projet.supabase.co",SUPABASE_ANON:"public"},
  navigator:{serviceWorker:{ready:Promise.resolve(reg)}},
  Notification:{permission:"default",requestPermission:async()=>{permissions++;return "granted";}},
  localStorage:{getItem:()=>null,setItem(){}},jourComptable:()=>"2026-10-26",
  STATE:{enfants:[{id:"e1",ddn:"2020-10-26"}]},SECT_LABELS:{},
  escapeHtml:String,openModal(){},closeModal(){},showToast(){},
  document:{getElementById:node},supabase:{auth:{getSession:async()=>({data:{session:{access_token:"valid"}}})}},
  fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body.action);return Response.json(body.action==="config"?{publicKey:"A".repeat(87)}:{active:true});}
 });
 vm.runInContext(fs.readFileSync("assets/js/push-notifications.js","utf8"),c);
 await c.ouvrirNotificationsPush();assert.equal(permissions,0);assert.equal(subscriptions,0);
 await node("pushActiver").listeners.click({currentTarget:node("pushActiver")});
 assert.equal(permissions,1);assert.equal(subscriptions,1);assert.deepEqual(calls,["config","subscribe"]);
});

console.log(tests+" scenarios push : OK");

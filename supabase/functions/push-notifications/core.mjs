export function jourBenin(now = new Date()) {
  const p = new Intl.DateTimeFormat("en", { timeZone:"Africa/Porto-Novo",year:"numeric",month:"2-digit",day:"2-digit" }).formatToParts(now);
  const v = t => p.find(x=>x.type===t).value;
  return v("year")+"-"+v("month")+"-"+v("day");
}
export function compterAnniversaires(enfants, now = new Date()) {
  const jour = jourBenin(now), annee = Number(jour.slice(0,4)), md = jour.slice(5);
  const bissextile = annee%4===0 && (annee%100!==0 || annee%400===0);
  return new Set(enfants.filter(e=>{
    const naissance = String(e.ddn || "").slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(naissance) || naissance > jour) return false;
    const d = new Date(naissance+"T00:00:00Z");
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==naissance) return false;
    return naissance.slice(5)===md || (!bissextile && md==="03-01" && naissance.slice(5)==="02-29");
  }).map(e=>e.id)).size;
}
export function abonnementValide(s) {
  try {
    const u = new URL(s.endpoint);
    const host = u.hostname;
    const autorise = ["fcm.googleapis.com","android.googleapis.com","updates.push.services.mozilla.com"].includes(host)
      || host.endsWith(".push.services.mozilla.com") || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com");
    return autorise && u.protocol==="https:" && !u.port && !u.username && !u.password && s.endpoint.length<=2048
      && /^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh || "") && /^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth || "");
  } catch { return false; }
}
export function createPushHandler({env, fetch, crypto, sendPush, now=()=>new Date()}) {
  return async request=>{
    const origins=(env("PUSH_ALLOWED_ORIGINS")||env("WHATSAPP_ALLOWED_ORIGINS")||"").split(",").map(x=>x.trim()).filter(Boolean);
    const origin=request.headers.get("origin");
    const headers={"Content-Type":"application/json","Cache-Control":"no-store",Vary:"Origin"};
    if(origin&&origins.includes(origin)) headers["Access-Control-Allow-Origin"]=origin;
    const json=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.includes(origin)) return json(403,{error:"Origine non autorisée."});
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{...headers,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"}});
    if(request.method!=="POST") return json(405,{error:"Méthode non autorisée."});
    const required=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","PUSH_VAPID_PUBLIC_KEY"];
    const missing=required.filter(k=>!env(k));
    if(missing.length) return json(503,{error:"Notifications non configurées sur le serveur.",missing});
    const admins=(env("PUSH_ADMIN_USER_IDS")||env("WHATSAPP_ADMIN_USER_IDS")||"").split(",").map(x=>x.trim()).filter(Boolean);
    if(!admins.length) return json(503,{error:"Aucun compte autorisé pour les notifications."});
    const base=env("SUPABASE_URL").replace(/\/$/,"");
    const dbHeaders={apikey:env("SUPABASE_SERVICE_ROLE_KEY"),Authorization:"Bearer "+env("SUPABASE_SERVICE_ROLE_KEY"),"Content-Type":"application/json"};
    const db=async(path,method="GET",body,extra={})=>{
      const r=await fetch(base+"/rest/v1/"+path,{method,headers:{...dbHeaders,...extra},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
      if(!r.ok){const e=new Error("Accès au stockage des notifications impossible.");e.status=r.status;e.code=(await r.json().catch(()=>({}))).code;throw e;}
      return r.status===204?null:r.json().catch(()=>null);
    };
    try {
      if(Number(request.headers.get("content-length"))>12000) return json(413,{error:"Requête trop volumineuse."});
      const raw=await request.text(); if(raw.length>12000) return json(413,{error:"Requête trop volumineuse."});
      let body;try{body=JSON.parse(raw);}catch{return json(400,{error:"JSON invalide."});}
      if(!body||typeof body!=="object") return json(400,{error:"Requête invalide."});
      const cron=request.headers.get("x-push-cron-secret");
      if(body.action==="daily"){
        const secret=env("PUSH_CRON_SECRET");
        if(!secret||!cron) return json(401,{error:"Appel planifié non autorisé."});
        const hash=async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
        const a=await hash(secret),b=await hash(cron);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
        if(diff) return json(401,{error:"Appel planifié non autorisé."});
        if(!env("PUSH_VAPID_PRIVATE_KEY")||!env("PUSH_VAPID_SUBJECT")) return json(503,{error:"Clés d'envoi push incomplètes."});
        const instant=now(),date=jourBenin(instant),enfants=[];
        for(let offset=0;;offset+=1000){
          const rows=await db("enfants?select=id,ddn&ddn=not.is.null&order=id&limit=1000&offset="+offset);
          enfants.push(...rows);if(rows.length<1000)break;
        }
        const count=compterAnniversaires(enfants,instant);
        if(!count)return json(200,{date,count:0,accepted:0,skipped:0});
        let accepted=0,skipped=0,failed=0;
        // L'heure limite empêche une livraison différée le lendemain.
        const ttl=Math.max(1,Math.floor((Date.parse(date+"T23:59:59+01:00")-instant.getTime())/1000));
        let apres="";
        for(;;){
          const rows=await db("push_subscriptions?select=id,owner_id,subscription,ack_date&active=eq.true&vapid_public_key=eq."+encodeURIComponent(env("PUSH_VAPID_PUBLIC_KEY"))+"&order=id&limit=100"+(apres?"&id=gt."+apres:""));
          for(const row of rows){
            if(!admins.includes(row.owner_id)||row.ack_date===date||!abonnementValide(row.subscription)){skipped++;continue;}
            try{await db("push_deliveries","POST",{subscription_id:row.id,on_date:date,status:"pending"},{Prefer:"return=minimal"});}
            catch(e){if(e.code==="23505"){skipped++;continue;}throw e;}
            let status="accepted",code=null;
            try{
              await sendPush(row.subscription,JSON.stringify({type:"anniversaires",date,count,title:"Les Bulles de Joie",body:(count===1?"Vous avez un anniversaire à consulter aujourd'hui.":"Vous avez "+count+" anniversaires à consulter aujourd'hui."),url:"app.html?notifications=anniversaires"}),ttl);
              accepted++;
            }catch(e){
              code=Number(e.statusCode)||null; status=code&&code>=400&&code<500?"failed":"unknown";failed++;
              if(code===404||code===410)await db("push_subscriptions?id=eq."+row.id,"PATCH",{active:false}).catch(()=>{});
            }
            // Une réponse incertaine n'est jamais renvoyée automatiquement.
            await db("push_deliveries?subscription_id=eq."+row.id+"&on_date=eq."+date,"PATCH",{status,error_code:code}).catch(()=>{});
          }
          if(rows.length<100)break;
          apres=rows[rows.length-1].id;
        }
        return json(200,{date,count,accepted,skipped,failed});
      }
      const auth=request.headers.get("authorization")||"";
      if(!/^Bearer \S+$/i.test(auth))return json(401,{error:"Connectez-vous avec le compte Supabase autorisé."});
      const ar=await fetch(base+"/auth/v1/user",{headers:{apikey:env("SUPABASE_SERVICE_ROLE_KEY"),Authorization:auth},signal:AbortSignal.timeout(10000)});
      if(!ar.ok)return json(401,{error:"Session expirée. Reconnectez-vous."});
      const user=await ar.json();if(!admins.includes(user.id))return json(403,{error:"Ce compte n'est pas autorisé à recevoir les notifications de l'école."});
      if(body.action==="config")return json(200,{publicKey:env("PUSH_VAPID_PUBLIC_KEY"),hour:"07:00",timeZone:"Africa/Porto-Novo"});
      const sub=body.subscription;
      if(!abonnementValide(sub))return json(400,{error:"Abonnement de cet appareil invalide."});
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(sub.endpoint));
      const id=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
      const rows=await db("push_subscriptions?id=eq."+id+"&select=owner_id");
      if(rows.length&&rows[0].owner_id!==user.id)return json(403,{error:"Cet appareil appartient à un autre compte. Désactivez son ancien abonnement sur ce téléphone."});
      if(body.action==="subscribe"){
        if(!rows.length){
          const existants=await db("push_subscriptions?owner_id=eq."+user.id+"&active=eq.true&select=id&limit=10");
          if(existants.length>=10)return json(409,{error:"Dix appareils déjà activés pour ce compte."});
        }
        const valeurs={id,owner_id:user.id,subscription:{endpoint:sub.endpoint,keys:sub.keys},active:true,vapid_public_key:env("PUSH_VAPID_PUBLIC_KEY"),updated_at:now().toISOString()};
        if(rows.length)await db("push_subscriptions?id=eq."+id+"&owner_id=eq."+user.id,"PATCH",valeurs);
        else {
          try{await db("push_subscriptions","POST",valeurs,{Prefer:"return=minimal"});}
          catch(e){if(e.code==="23505")return json(409,{error:"Cet appareil vient d'être enregistré. Rouvrez les notifications pour vérifier son compte."});throw e;}
        }
        return json(200,{active:true});
      }
      if(!rows.length)return json(200,{active:false});
      if(body.action==="unsubscribe"){
        await db("push_subscriptions?id=eq."+id+"&owner_id=eq."+user.id,"PATCH",{active:false});
        return json(200,{active:false});
      }
      if(body.action==="ack"){
        await db("push_subscriptions?id=eq."+id+"&owner_id=eq."+user.id,"PATCH",{ack_date:jourBenin(now())});
        return json(200,{acknowledged:true});
      }
      return json(400,{error:"Action inconnue."});
    }catch(_){return json(503,{error:"Notifications temporairement indisponibles. Vérifiez les migrations et la configuration Supabase."});}
  };
}

// Notifications Web Push de l'équipe de l'école. Aucun secret serveur ici.
var clientAuthPush = null;
function anniversairesDuJour() {
  const date=jourComptable(), md=date.slice(5), annee=Number(date.slice(0,4));
  const bis=annee%4===0&&(annee%100!==0||annee%400===0);
  return STATE.enfants.filter(e=>{
    const d=String(e.ddn||"").slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>date)return false;
    const test=new Date(d+"T00:00:00Z");
    if(!Number.isFinite(test.getTime())||test.toISOString().slice(0,10)!==d)return false;
    return d.slice(5)===md||(!bis&&md==="03-01"&&d.slice(5)==="02-29");
  });
}
function nombreAnniversairesLus() {
  try{const lu=JSON.parse(localStorage.getItem("bdj_push_lus"));return lu?.date===jourComptable()?Number(lu.count)||0:0;}catch{return 0;}
}
async function actualiserBadgeAnniversaires() {
  if(typeof navigator==="undefined")return;
  const count=Math.max(anniversairesDuJour().length-nombreAnniversairesLus(),0);
  try{
    if(count&&navigator.setAppBadge)await navigator.setAppBadge(count);
    else if(navigator.clearAppBadge)await navigator.clearAppBadge();
  }catch(_){}
}
async function acquitterAnniversaires() {
  const date=jourComptable(),count=anniversairesDuJour().length;
  try{localStorage.setItem("bdj_push_lus",JSON.stringify({date,count}));}catch(_){}
  navigator.serviceWorker?.controller?.postMessage({type:"BDJ_BIRTHDAY_READ",date,count});
  await actualiserBadgeAnniversaires();
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    const notifications=reg?await reg.getNotifications():[];
    notifications.filter(n=>String(n.tag).startsWith("bdj-anniversaires-")).forEach(n=>n.close());
    const sub=await reg?.pushManager.getSubscription();
    const client=await clientPushConnecte();
    if(sub&&client)await appelerPush("ack",{subscription:sub.toJSON()},client);
  }catch(_){}
}
function ouvrirAnniversairesDuJour() {
  const liste=anniversairesDuJour();
  openModal(`<div class="modal-title">Anniversaires du jour — ${liste.length}</div>
    ${liste.length?liste.map(e=>`<p><strong>${escapeHtml(e.nom)}</strong> — ${escapeHtml(SECT_LABELS[e.sect]||e.sect)}</p>`).join(""):'<p>Aucun anniversaire aujourd’hui.</p>'}
    <div class="modal-actions"><button class="btn btn-ghost" id="pushAnnivFermer">Fermer</button></div>`);
  document.getElementById("pushAnnivFermer").addEventListener("click",closeModal);
  acquitterAnniversaires();
}
async function clientPushConnecte(){
  if(clientAuthPush){const r=await clientAuthPush.auth.getSession();if(r.data?.session)return clientAuthPush;}
  const r=await supabase.auth.getSession();return r.data?.session?supabase:null;
}
async function appelerPush(action,body={},client){
  client=client||await clientPushConnecte();
  const session=client&&(await client.auth.getSession()).data.session;
  if(!session)throw new Error("Connexion Supabase requise pour cet appareil.");
  let response;
  try{response=await fetch(window.SUPABASE_URL+"/functions/v1/push-notifications",{
    method:"POST",headers:{apikey:window.SUPABASE_ANON,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
    body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(20000)
  });}catch(_){throw new Error("Connexion aux notifications impossible. Vérifiez le réseau, le déploiement et l'origine autorisée.");}
  const r=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(r.error||"Service de notifications indisponible.");e.status=response.status;throw e;}
  return r;
}
function clePushBytes(cle){
  const brut=atob(cle.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(brut,c=>c.charCodeAt(0));
}
async function ouvrirNotificationsPush(forcerConnexion=false){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){
    openModal('<div class="modal-title">Notifications sur cet appareil</div><p>Ce navigateur ne propose pas Web Push ici. Sur iPhone, ajoutez le site à l’écran d’accueil puis ouvrez cette application installée. Vérifiez aussi que vous utilisez le site HTTPS.</p><div class="modal-actions"><button id="pushFermer" class="btn btn-ghost">Fermer</button></div>');
    document.getElementById("pushFermer").addEventListener("click",closeModal);return;
  }
  const client=forcerConnexion?null:await clientPushConnecte();
  if(!client){
    openModal('<div class="modal-title">Activer les notifications de l’école</div><p>Connectez le compte Supabase autorisé pour inscrire ce téléphone. Votre identifiant habituel du logiciel reste disponible.</p><div class="field"><label>Email</label><input id="pushEmail" type="email" autocomplete="username"></div><div class="field"><label>Mot de passe</label><input id="pushPassword" type="password" autocomplete="current-password"></div><p id="pushErreur" role="alert" class="text-red"></p><div class="modal-actions"><button id="pushFermer" class="btn btn-ghost">Fermer</button><button id="pushLogin" class="btn btn-primary">Se connecter</button></div>');
    document.getElementById("pushFermer").addEventListener("click",closeModal);
    document.getElementById("pushLogin").addEventListener("click",async ev=>{
      const b=ev.currentTarget;b.disabled=true;
      try{
        if(!clientAuthPush)clientAuthPush=window.creerClientSupabase(window.SUPABASE_URL,window.SUPABASE_ANON,{auth:{persistSession:false,autoRefreshToken:true}});
        const {error}=await clientAuthPush.auth.signInWithPassword({email:document.getElementById("pushEmail").value.trim(),password:document.getElementById("pushPassword").value});
        if(error)throw new Error("Connexion refusée. Vérifiez l'email et le mot de passe.");
        document.getElementById("pushPassword").value="";await ouvrirNotificationsPush();
      }catch(e){document.getElementById("pushErreur").textContent=e.message;b.disabled=false;}
    });return;
  }
  try{
    const config=await appelerPush("config",{},client);
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    openModal(`<div class="modal-title">Notifications d’anniversaire</div><p>Alerte quotidienne à 7 h, heure du Bénin, uniquement si des enfants fêtent leur anniversaire. Vous pouvez la recevoir quand le logiciel est fermé.</p><p>Sur cet appareil : <strong>${sub?"abonnement navigateur présent":"non activées"}</strong>. Autorisation : ${escapeHtml(Notification.permission)}.</p><p class="field-hint">Le chiffre sur l’icône dépend du téléphone ; Android peut afficher seulement un point.</p><p id="pushEtat" role="status"></p><div class="modal-actions"><button class="btn btn-ghost" id="pushFermer">Fermer</button><button class="btn btn-secondary" id="pushVoir">Anniversaires du jour</button><button class="btn btn-primary" id="pushActiver">${sub?"Vérifier / réactiver cet appareil":"Activer sur cet appareil"}</button>${sub?'<button class="btn btn-secondary" id="pushTester">Tester l’affichage</button><button class="btn btn-danger" id="pushDesactiver">Désactiver</button>':""}</div>`);
    const etat=t=>{document.getElementById("pushEtat").textContent=t;};
    document.getElementById("pushFermer").addEventListener("click",closeModal);
    document.getElementById("pushVoir").addEventListener("click",ouvrirAnniversairesDuJour);
    document.getElementById("pushActiver").addEventListener("click",async ev=>{
      const bouton=ev.currentTarget;bouton.disabled=true;
      try{
        // Demande directement déclenchée par le geste de l'utilisatrice.
        const permission=await Notification.requestPermission();
        if(permission!=="granted")throw new Error("Autorisez les notifications dans les paramètres de ce navigateur.");
        if(sub){
          const key=sub.options?.applicationServerKey;
          const cible=clePushBytes(config.publicKey);
          if(key&&new Uint8Array(key).some((v,i)=>v!==cible[i])){
            await appelerPush("unsubscribe",{subscription:sub.toJSON()},client);await sub.unsubscribe();sub=null;
          }
        }
        if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:clePushBytes(config.publicKey)});
        await appelerPush("subscribe",{subscription:sub.toJSON()},client);
        if(anniversairesDuJour().length>0&&nombreAnniversairesLus()>=anniversairesDuJour().length)await appelerPush("ack",{subscription:sub.toJSON()},client);
        etat("Cet appareil est enregistré pour les prochains anniversaires.");
        await actualiserBadgeAnniversaires();
      }catch(e){etat(e.message);}finally{bouton.disabled=false;}
    });
    document.getElementById("pushDesactiver")?.addEventListener("click",async ev=>{
      ev.currentTarget.disabled=true;
      try{await appelerPush("unsubscribe",{subscription:sub.toJSON()},client);await sub.unsubscribe();sub=null;document.getElementById("pushActiver").textContent="Activer sur cet appareil";await actualiserBadgeAnniversaires();etat("Notifications désactivées sur cet appareil.");}
      catch(e){etat(e.message);ev.currentTarget.disabled=false;}
    });
    document.getElementById("pushTester")?.addEventListener("click",async()=>{
      try{await reg.showNotification("Les Bulles de Joie",{body:"Test d’affichage des notifications sur cet appareil.",icon:"assets/img/icons/icon-192.png",tag:"bdj-test",data:{url:"app.html"}});etat("Test local affiché. Ce test ne déclenche pas d'envoi aux parents.");}
      catch(e){etat(e.message);}
    });
  }catch(e){if([401,403].includes(e.status))return ouvrirNotificationsPush(true);showToast(e.message,"error");}
}
var minuteriePushJour = null;
function planifierBadgeAnniversaires(){
  if(minuteriePushJour)clearTimeout(minuteriePushJour);
  const prochain=Date.parse(jourComptable()+"T00:00:00+01:00")+86400000;
  minuteriePushJour=setTimeout(()=>{actualiserBadgeAnniversaires();planifierBadgeAnniversaires();},Math.max(1000,prochain-Date.now()+100));
}
function initPushNotifications(){
  planifierBadgeAnniversaires();
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)actualiserBadgeAnniversaires();});
  ["btnPushNotifications","btnPushNotificationsMobile"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>ouvrirNotificationsPush().catch(e=>showToast(e.message,"error"))));
  if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("message",event=>{if(event.data?.type==="BDJ_OPEN_BIRTHDAYS")ouvrirAnniversairesDuJour();});
  let ouvrir=new URLSearchParams(window.location.search).get("notifications")==="anniversaires";
  try{ouvrir=ouvrir||sessionStorage.getItem("bdj_push_open")==="1";sessionStorage.removeItem("bdj_push_open");}catch(_){}
  if(ouvrir)ouvrirAnniversairesDuJour();else actualiserBadgeAnniversaires();
}

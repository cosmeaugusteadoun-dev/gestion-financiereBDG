import webpush from "npm:web-push@3.6.7";
import { createECDH, randomBytes } from "node:crypto";
// Vérifie le chiffrement avec une fausse destination, sans accès réseau.
const env=Object.fromEntries(Deno.readTextFileSync(".env.push.local").trim().split(/\r?\n/).map(l=>{
  const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];
}));
const device=createECDH("prime256v1");device.generateKeys();
const details=webpush.generateRequestDetails({
  endpoint:"https://fcm.googleapis.com/fcm/send/local-test-only",
  keys:{p256dh:device.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")},
},JSON.stringify({type:"anniversaires",count:2,date:"2026-10-26"}),{
  TTL:3600,topic:"bdj-anniversaires",vapidDetails:{
    subject:env.PUSH_VAPID_SUBJECT,publicKey:env.PUSH_VAPID_PUBLIC_KEY,privateKey:env.PUSH_VAPID_PRIVATE_KEY
  }
});
if(!details.body?.length || !details.headers.Authorization || details.headers["Content-Encoding"]!=="aes128gcm")throw new Error("Requête Web Push invalide.");
console.log("Deno : clés VAPID et chiffrement Web Push valides, aucun envoi réseau.");

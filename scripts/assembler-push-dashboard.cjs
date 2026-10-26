const fs=require('node:fs');
const dossier='supabase/functions/push-notifications/';
const entree=fs.readFileSync(dossier+'index.ts','utf8').replace('import { createPushHandler } from "./core.mjs";','');
let core=fs.readFileSync(dossier+'core.mjs','utf8');
// Adapter les types JS du coeur testable pour un fichier TypeScript unique.
core=core.replace('compterAnniversaires(enfants,','compterAnniversaires(enfants: any[],')
 .replace('abonnementValide(s)','abonnementValide(s: any)')
 .replace('now=()=>new Date()})','now=()=>new Date()}: any)')
 .replace('const headers={','const headers: Record<string,string>={')
 .replace('const json=(status,body)=>','const json=(status: number,body: unknown)=>')
 .replace('const db=async(path,method="GET",body,extra={})=>','const db=async(path: string,method="GET",body: unknown=undefined,extra: Record<string,string>={})=>')
 .replace('const e=new Error','const e: any=new Error')
 .replace(/catch\(e\)/g,'catch(e: any)')
 .replace(/\b([A-Za-z_$][\w$]*)\s*=>/g,'($1: any) =>')
 .replace('p.find((x: any) =>x.type===t).value','p.find((x: any) =>x.type===t)?.value || ""');
fs.writeFileSync('supabase/push-notifications-dashboard.ts',entree.replace('Deno.serve(',core+'\nDeno.serve('));
console.log('supabase/push-notifications-dashboard.ts prêt pour l’éditeur Supabase.');

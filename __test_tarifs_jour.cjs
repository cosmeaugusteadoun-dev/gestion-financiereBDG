const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',querySelectorAll:()=>[]});return nodes.get(id);};
let timer,delai;
const ctx=vm.createContext({console,Intl,Date,setTimeout:(fn,ms)=>{timer=fn;delai=ms;return 1;},clearTimeout(){},window:{addEventListener(){}},document:{getElementById:node}});
for(const file of ['db.js','postes.js','whatsapp.js','enfants.js','entrees.js','dashboard.js'])vm.runInContext(fs.readFileSync('assets/js/'+file,'utf8'),ctx);
ctx.majCompteurListe=()=>{};ctx.calculerRecettesParSecteur=()=>({});ctx.refreshAllTabs=()=>{};ctx.showToast=()=>{};
let n=0;function test(nom,fn){fn();n++;console.log('OK '+nom);}
async function main(){
test('fournitures maternelle : 20 000 F, primaire et creche libres',()=>{for(const sect of ctx.MAT_SECTS){const p=ctx.buildPostes(sect,'nouveau',{four:'oui'}).find(p=>p.key==='four');assert.equal(p.du,20000);assert.equal(p.is_var,false);}for(const sect of [...ctx.PRIM_SECTS,'creche'])assert.equal(ctx.buildPostes(sect,'nouveau',{four:'oui'}).find(p=>p.key==='four').is_var,true);});
test('garderie : septembre/mars/juin 1 500, octobre 3 000 dans tous les dossiers',()=>{for(const sect of [...ctx.MAT_SECTS,...ctx.PRIM_SECTS,'garderie']){const ps=ctx.buildPostes(sect,'nouveau',{gard:'oui'});for(const mois of ctx.MOIS_CANTINE_REDUITS)assert.equal(ps.find(p=>p.key==='gard_'+mois).du,1500);assert.equal(ps.find(p=>p.key==='gard_Oct').du,3000);}});
const e={id:'e',nom:'Test',sect:ctx.MAT_SECTS[0],stat:'nouveau',opt:{four:'oui',gard:'oui'}};
ctx.STATE={enfants:[e],postes:ctx.fabriquerPostesEnfant(e.id,e.sect,e.stat,e.opt),entrees:[],sorties:[],suivi:[]};
const gard=ctx.STATE.postes.find(p=>p.key==='gard_Sep');gard.du=3000;gard.paye=1500;
const four=ctx.STATE.postes.find(p=>p.key==='four');four.du=0;four.is_var=true;four.paye=5000;
ctx.dbUpsertPostes=async()=>{};await ctx.synchroniserEtReparerDossiers();
test('anciens dossiers : 1 500 F de garderie soldent septembre, credits conserves',()=>{assert.equal(gard.du,1500);assert.equal(gard.paye,1500);assert.equal(ctx.posteEnRetard(gard),false);assert.ok(!ctx.construireSectionFinanciere(e,[gard]).includes('1 500 F CFA en retard'));});
test('fournitures : ancien montant libre devient fixe et alerte sur 15 000 F',()=>{assert.equal(four.du,20000);assert.equal(four.paye,5000);assert.equal(four.is_var,false);assert.equal(ctx.posteEnRetard(four),true);assert.equal(ctx.posteRetardsDetail([four])[0].manque,15000);});
const snap=JSON.stringify(ctx.STATE.postes);await ctx.synchroniserEtReparerDossiers();
test('synchronisation repetee : aucun double credit',()=>assert.equal(JSON.stringify(ctx.STATE.postes),snap));
const lignes=[{key:'four',cat:'Fournitures',paye:0},{key:'var_fournitures',cat:'Fournitures',paye:20000}];ctx.appliquerTarifsFixes(e.sect,lignes);
test('anciennes lignes de fournitures multiples : 20 000 F au total, pas de faux retard',()=>{assert.equal(lignes.reduce((s,p)=>s+p.du,0),20000);assert.equal(ctx.posteRetardsDetail(lignes).length,0);});
const choix=ctx.preparerMoisNonSouscrits(e,{gard_Sep:false,gard_Mar:true});
test('absence conservee sans dette, mois reactive au bon tarif',()=>{assert.equal(choix.postes.find(p=>p.key==='gard_Mar').du,0);assert.equal(choix.postes.find(p=>p.key==='gard_Sep').du,1500);});
test('date comptable : passage a minuit au Benin, independant du fuseau du navigateur',()=>{assert.equal(ctx.jourComptable(new Date('2026-10-26T22:59:59Z')),'2026-10-26');assert.equal(ctx.jourComptable(new Date('2026-10-26T23:00:00Z')),'2026-10-27');});
let maintenant='2026-10-26T22:59:59Z';ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[maintenant]));}static now(){return new Date(maintenant).getTime();}};
ctx.STATE.entrees=[{date:'2026-10-26',mt:1000},{date:'2026-10-25',mt:9000},{date:'2026-10-26',mt:'2000'}];ctx.STATE.sorties=[{date:'2026-10-26',mt:500},{date:'2026-10-25',mt:7000}];ctx.renderEntreesMetrics();
test('totaux du jour distincts des cumuls',()=>{assert.match(node('entreesMetrics').innerHTML,/Entrées du jour<\/div><div class="metric-value">3 000 F CFA/);assert.match(node('entreesMetrics').innerHTML,/Sorties du jour<\/div><div class="metric-value">500 F CFA/);});
ctx.planifierCompteursJour();assert.ok(delai>0&&delai<2000);maintenant='2026-10-26T23:00:01Z';timer();
test('minuit : compteurs du jour a zero et historique conserve',()=>{assert.equal(ctx.STATE.entrees.length,3);assert.equal((node('entreesMetrics').innerHTML.match(/0 F CFA/g)||[]).length>=2,true);});
console.log(n+' scenarios tarifs et compteurs : OK');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

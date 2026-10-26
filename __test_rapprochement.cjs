const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console,window:{addEventListener(){}},document:{}});
for(const f of ['db.js','postes.js','bilans.js'])vm.runInContext(fs.readFileSync('assets/js/'+f,'utf8'),ctx);
ctx.STATE={enfants:[{id:'a',sect:'mat1'},{id:'b',sect:'ci'}],postes:[],entrees:[],sorties:[]};
const total=o=>Object.values(o).reduce((s,n)=>s+n,0);let n=0;function test(label,f){f();n++;console.log('OK '+label);}
ctx.STATE.postes=[{id:'four',enfant_id:'a',key:'four',cat:'Fournitures',paye:25000,du:20000}];
ctx.STATE.entrees=[{enfant_id:'a',mt:20000,sect:'Fournitures',allocations:[{poste_id:'four',montant:20000}]}];
test('credits dossier et remise ne gonflent pas la caisse',()=>assert.equal(ctx.calculerEncaisseParSecteurBilan().Fournitures,20000));
ctx.STATE.entrees=[{enfant_id:'a',mt:20000,sect:'Fournitures, Inscription',allocations:[{poste_id:'archive',montant:15000,poste:{id:'archive',key:'four',cat:'Fournitures',enfant_id:'a'}},{secteur:'Inscription',montant:5000}]}];
test('poste archive : ventilation et classe de l inscription conservees',()=>{assert.equal(ctx.calculerRecettesParSecteur(true).Fournitures,15000);assert.equal(ctx.calculerEncaisseParSecteurBilan().Maternelle,5000);assert.equal(total(ctx.calculerEncaisseParSecteurBilan()),20000);});
ctx.STATE.entrees=[{mt:100,sect:'Creche, Assurance, APE'}];
test('ancienne entree sans trace : parts entieres et total exact',()=>{assert.equal(total(ctx.calculerRecettesParSecteur(true)),100);assert.ok(Object.values(ctx.calculerRecettesParSecteur(true)).every(Number.isInteger));assert.equal(ctx.ventilerEncaissements().paiementsEstimes,1);});
ctx.STATE.entrees=[{mt:8000,sect:'Petit-dejeuner, Dejeuner',allocations:[{secteur:'Petit-dejeuner',montant:3000},{secteur:'Dejeuner',montant:5000}]}];
test('services distincts dans Entrees, regroupes dans bilan sans double compte',()=>{const r=ctx.calculerRecettesParSecteur(true);assert.equal(r['Petit-déjeuner'],3000);assert.equal(r['Déjeuner'],5000);assert.equal(ctx.calculerEncaisseParSecteurBilan().Cantine,8000);});
ctx.STATE.entrees=[{mt:10000,sect:'Fournitures',allocations:[{secteur:'Fournitures',montant:8000},{secteur:'Fournitures',montant:8000}]},{mt:5000,sect:''}];
test('allocations excessives plafonnees et entree non classee visible',()=>{assert.equal(total(ctx.calculerEncaisseParSecteurBilan()),15000);assert.equal(ctx.calculerEncaisseParSecteurBilan()['Non classé'],5000);});
const root={id:'bilansSecteurs',innerHTML:''};ctx.document={getElementById:id=>id==='bilansSecteurs'?root:null};ctx.majCompteurListe=()=>{};
ctx.renderBilans();test('carte non classee affichee dans le bilan',()=>assert.ok(root.innerHTML.includes('Non classé')));
for(let k=1;k<=100;k++){
 ctx.STATE.entrees=[{enfant_id:k%2?'a':'b',mt:k*137,sect:'Inscription, Cantine, Fournitures',allocations:[{secteur:'Fournitures',montant:k*23}]}];
 assert.equal(total(ctx.calculerRecettesParSecteur(true)),k*137);assert.equal(total(ctx.calculerEncaisseParSecteurBilan()),k*137);
}
test('100 paiements de montants varies : caisse = repartition = bilans',()=>{});
console.log(n+' scenarios rapprochement : OK');

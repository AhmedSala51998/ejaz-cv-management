import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseText,spatial,textRows,finalizeData} from '../lib/parser';
import {normalizeNationality} from '../lib/countries';
const c=(str:string,x:number,y:number,width=70)=>({str,transform:[1,0,0,1,x,y],width,height:10});
test('living town is bounded before age and children labels',()=>{
 const d=parseText('Living Town TEST TOWN  Real Age 42 YEARS\nNo of children ONE');assert.equal(d.address,'TEST TOWN');assert.equal(d.age,'42');assert.equal(d.children,'1');
 assert.equal(normalizeNationality('بنجالديش'),'BANGLADESHI');
});
test('split marital label and source spelling retain a single aligned answer',()=>{
 for(const [value,expected] of [['MARRIEED','MARRIED'],['DIVORCED','DIVORCED']]){
 const items=[c('ADDRESS',10,540),c('TEST TOWN',110,540),c('MARITAL',10,520),c('STATUS',10,510),c(value,110,515),c('NO OF CHILDREN',10,490),c('ONE',110,490)];
 const d=finalizeData({...parseText(textRows(items)),...spatial(items)},textRows(items)).data;
 assert.equal(d.address,'TEST TOWN');assert.equal(d.marital,expected);assert.equal(d.children,'1');
 }
});
test('rated skills preserve combined activities and exclude negative cooking',()=>{
 const items=[c('IRONING',10,500),c('GOOD',180,500),c('COOKING',10,480),c('NOT GOOD',180,480),c('CLEANING AND WASHING',10,460,145),c('GOOD',180,460),c('TAKING CARE OF THE OLD',10,440,145),c('GOOD',180,440)];
 const d=spatial(items);for(const n of ['Ironing','Cleaning','Washing','Elderly Care'])assert(d.skills.includes(n));assert(!d.skills.includes('Cooking'));assert.equal(d.skills.split('، ').length,4);
});
test('horizontal yes cells align independently and blank skills stay absent',()=>{
 const items=[c('Cleaning Washing Ironing Kids Care Baby Care',100,500,300),...Array.from({length:5},(_,i)=>c('YES',104+i*60,474,25)),c('Old People Care',100,450,100)];
 const d=spatial(items);for(const n of ['Cleaning','Washing','Ironing','Child Care','Baby Care'])assert(d.skills.includes(n));assert(!d.skills.includes('Elderly'));
});
test('empty spatial skills cannot erase positive text evidence',()=>{
 const d={...parseText('Cleaning YES\nElderly Care YES'),...spatial([])};assert(d.skills.includes('Cleaning'));assert(d.skills.includes('Elderly Care'));
});
test('worker name headings cannot pollute generated Arabic name',()=>{
 const d=finalizeData({name:'TEST PERSON',nameAr:'TEST PERSON WORKER’S NAME'},'').data;assert(!d.nameAr);
 assert.equal(parseText('WORKER’S NAME TEST PERSON').name,'TEST PERSON');
});

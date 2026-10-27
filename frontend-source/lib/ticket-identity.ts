import {Ticket} from './ticket-parser';
export function applyUniqueIdentities(data:Ticket,results:any[]):Ticket {
 const passports=new Set(data.passengers.map(p=>p.passport).filter(Boolean));
 return {...data,passengers:data.passengers.map((p,index)=>{
  const r=results.find(r=>r.index===index);
  if((!p.name||!p.passport)&&r?.unique&&r.candidates.length===1){
   const cv=r.candidates[0];
   if(p.passport&&p.passport!==cv.passport)return p;
   if(!p.passport&&passports.has(cv.passport))return p;
   passports.add(cv.passport);
   return {...p,name:p.name||cv.name,passport:p.passport||cv.passport,cvRecordId:cv.id,identitySource:'CV: '+cv.id};
  }
  return p;
 })};
}

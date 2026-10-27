import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyTicket,emptyPassenger,emptySegment} from '../lib/ticket-parser';
import {applyUniqueIdentities} from '../lib/ticket-identity';
import {essentialTicketWarnings} from '../lib/ticket-checks';
const cv={id:'cv1',name:'JANE DOE',passport:'AB0012345'};
test('missing passport is completed from one confirmed candidate and ticket name stays unchanged',()=>{
 const t=emptyTicket();t.passengers=[{...emptyPassenger(),name:'DOE/JANE'}];
 const r=applyUniqueIdentities(t,[{index:0,unique:true,candidates:[cv]}]);
 assert.equal(r.passengers[0].name,'DOE/JANE');assert.equal(r.passengers[0].passport,cv.passport);assert.equal(r.passengers[0].cvRecordId,cv.id);assert.equal(t.passengers[0].passport,'');
});
test('missing name can be completed using passport, ambiguity and no identity are never auto-filled',()=>{
 const t=emptyTicket();t.passengers=[{...emptyPassenger(),passport:cv.passport},emptyPassenger()];
 const r=applyUniqueIdentities(t,[{index:0,unique:true,candidates:[cv]},{index:1,unique:false,candidates:[cv]}]);
 assert.equal(r.passengers[0].name,cv.name);assert.equal(r.passengers[1].name,'');
 assert.equal(applyUniqueIdentities(t,[{index:1,unique:true,candidates:[cv,{...cv,id:'cv2'}]}]).passengers[1].name,'');
});
test('existing identities cannot be overwritten or assigned twice across a multi passenger ticket',()=>{
 const t=emptyTicket();t.passengers=[{...emptyPassenger(),name:'PERSON ONE',passport:cv.passport},{...emptyPassenger(),name:'JANE DOE'}];
 const r=applyUniqueIdentities(t,[{index:1,unique:true,candidates:[cv]}]);assert.equal(r.passengers[1].passport,'');
 t.passengers=[{...emptyPassenger(),passport:'ZZ99999'}];assert.equal(applyUniqueIdentities(t,[{index:0,unique:true,candidates:[cv]}]).passengers[0].name,'');
});
test('essential warnings include all critical itinerary fields and unresolved passenger identity',()=>{
 const t=emptyTicket();t.passengers=[emptyPassenger()];t.segments=[emptySegment()];
 const w=essentialTicketWarnings(t).join(' ');for(const term of ['الاسم','الجواز','رقم الرحلة','مدينة المغادرة','مدينة الوصول','تاريخ المغادرة','وقت المغادرة','تاريخ الوصول','وقت الوصول','الناقل'])assert.ok(w.includes(term),term);
 t.passengers=[{...emptyPassenger(),name:cv.name,passport:cv.passport}];t.airline='Airline';t.segments=[{...emptySegment(),flightNumber:'AA123',from:'City A',to:'City B',departureDate:'2026-11-08',arrivalDate:'2026-11-08',departureTime:'10:00',arrivalTime:'13:00'}];assert.deepEqual(essentialTicketWarnings(t),[]);
});

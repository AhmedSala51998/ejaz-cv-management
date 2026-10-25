import {test} from 'node:test';import assert from 'node:assert/strict';
import {photoPageKind,orderPhotos} from '../lib/photo-policy';
import {shouldUseReviewedSkills} from '../lib/skill-policy';
test('worker application templates remain CV pages despite passport and nationality labels',()=>{
 for(const title of ['WORKER’S NAME','WORKER\'S NAME','APPLICATION FOR EMPLOYEMENT','DETAILS OF CANDIDATE'])assert.equal(photoPageKind(title+' PASSPORT NO. NATIONALITY'),'profile');
 assert.equal(photoPageKind('REPUBLIC PASSPORT P<BGD'),'passport');assert.equal(photoPageKind('Unlabeled image'),'uncertain');
});
test('full CV image takes priority and repeated detections do not hide alternatives',()=>{
 const candidates=[{src:'head',kind:'profile'},{src:'head',kind:'profile'},{src:'passport',kind:'passport',fullBody:true},{src:'body',kind:'profile',fullBody:true},{src:'body',kind:'profile',fullBody:true}];
 assert.deepEqual(orderPhotos(candidates).map(p=>p.src),['body','head','passport']);
});
test('empty OCR never overwrites extracted skills even if ink detector reports coverage',()=>{
 for(const verified of [false,true]){assert(!shouldUseReviewedSkills('Cleaning، Washing','',false,verified));assert(!shouldUseReviewedSkills('Cleaning','  ',true,verified));}
 assert(!shouldUseReviewedSkills('Cleaning، Washing','Cleaning',false,false));assert(shouldUseReviewedSkills(undefined,'Ironing',false,false));assert(shouldUseReviewedSkills('Cooking','Ironing',true,false));assert(shouldUseReviewedSkills('Cooking','Ironing',false,true));
});

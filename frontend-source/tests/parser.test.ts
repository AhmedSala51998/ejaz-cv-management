import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseText,spatial,finalizeData,textRows} from '../lib/parser.ts';
const sample=`Full Name / الاسم  SAMPLE APPLICANT NAME
Age / العمر  21
Post Applied / الوظيفة  HOUSE WORKER
Monthly Salary / الراتب  1,000 SR
Nationality / الجنسية  Ethiopia  Passport No. / الرقم  EQ1234567
Religion / الديانة  Islam  Date of Issue / تاريخ الإصدار  01/11/2025
Date of Birth / تاريخ الولادة  23/09/2005  Place of Issue / مكان الإصدار  Ethiopia
Place of Birth / مكان الولادة  TEST CITY  Date of Expiry / تاريخ الانتهاء  31/10/2030
Maritial Status / الحالة الاجتماعية  Single
No. of Childern / عدد الأطفال  0
Education Level / مستوى التعليم  PRIMARY SCHOOL
Experience Abroad
Country  Period
NONE
Skills
Driving  Cleaning
Ironing  Cooking
Babysitting  Washing`;
test('bilingual neighboring columns stay separate, including misspelled labels',()=>{const d=parseText(sample);assert.equal(d.name,'SAMPLE APPLICANT NAME');assert.equal(d.passport,'EQ1234567');assert.equal(d.birthPlace,'TEST CITY');assert.equal(d.religion,'Islam');assert.equal(d.job,'HOUSE WORKER');assert.equal(d.education,'PRIMARY SCHOOL');assert.equal(d.children,'0');assert.equal(d.salary,'1000');assert.equal(d.currency,'SAR');assert.equal(d.experience,'FIRST TIMER');assert(!d.experienceCountry);assert(!d.skills);});
test('positive experience and no experience remain distinct',()=>{const d=parseText('Experience Abroad\nCountry SAUDI ARABIA\nPeriod 2 YEARS\nSkills\nCleaning');assert.equal(d.experience,'2 YEARS');assert.equal(d.experienceCountry,'SAUDI ARABIA');assert(!parseText('Experience Abroad\nCountry Period\nSkills\nCleaning').experience);});
test('printed language choices are not selected answers',()=>{const d=parseText('English Arabic\nPoor Fair Good Poor Fair Good');assert(!d.english);assert(!d.arabic);});
test('legacy labels and selected text skills are retained',()=>{const d=parseText('Full name: SAMPLE NAME\nOccupation: DOMESTIC HELPER\nPassport number: AB1234567\nReligion: MUSLIM\nCleaning YES\nCooking NO');assert.equal(d.name,'SAMPLE NAME');assert.equal(d.job,'DOMESTIC HELPER');assert.equal(d.passport,'AB1234567');assert.equal(d.skills,'Cleaning YES');});
test('spatial bilingual values are bounded by the next column',()=>{const item=(str:string,x:number,width:number)=>({str,transform:[1,0,0,1,x,500],height:10,width});const d=spatial([item('Religion / الديانة',10,100),item('Islam',130,25),item('Date of Issue / تاريخ الإصدار',250,130),item('01/11/2025',400,55)]);assert.equal(d.religion,'Islam');assert.equal(d.issueDate,'01/11/2025');});
test('empty height and weight stay empty',()=>{const d=finalizeData(parseText(sample+'\nWeight / الوزن\nHeight / الطول'),sample).data;assert(!d.height);assert(!d.weight);});
test('OCR transliteration of Arabic beside a slash is not a field value',()=>{const d=parseText('Full Name / xdl)\nSAMPLE PERSON NAME\nPost Applied / dll 4\nHOUSE WORKER\nMaritial Status / blah\nSingle\nEducation Level / xdl\nPRIMARY SCHOOL');assert.equal(d.name,'SAMPLE PERSON NAME');assert.equal(d.job,'HOUSE WORKER');assert.equal(d.marital,'Single');assert.equal(d.education,'PRIMARY SCHOOL');});
test('leading bullets in OCR labels do not hide aligned values',()=>{const item=(str:string,x:number,width:number)=>({str,transform:[1,0,0,1,x,500],height:10,width});const d=spatial([item('= Maritial Status / xdl',10,150),item('Single',200,35)]);assert.equal(d.marital,'Single');});

test('inline language rating menus are not answers',()=>{const d=parseText('English Poor Fair Good\nArabic Poor Fair Good');assert(!d.english);assert(!d.arabic);});

test('education OCR digits cannot become height or weight',()=>{for(const junk of ['Education Level (5 sie PRIMARY SCHOOL','EducationLevel(5siePRIMARYSCHOOL','CLASS 4','PRIMARY SCHOOL 5','Education Level 158']){const d=finalizeData({height:junk,weight:junk},'').data;assert(!d.height,junk);assert(!d.weight,junk);}const d=parseText('Height\nEducation Level (5 sie PRIMARY SCHOOL');assert(!d.height);});
test('real measurements retain the formats used in existing CVs',()=>{for(const height of ['158','158 cm','1.58','1.58 M','5,2','5 FIT 2 INCH','154 cm 57 kg'])assert(finalizeData({height},'').data.height,height);for(const weight of ['48','56 KG','56.5','٥٦ كجم'])assert(finalizeData({weight},'').data.weight,weight);});
test('checked marital choice, raised skill ticks and remarks above their label survive tables',()=>{
 const cell=(str:string,x:number,y:number,width=35)=>({str,transform:[1,0,0,1,x,y],width,height:11});
 const items=[cell('Marital Status',230,556,68),cell('Single',320,556,30),cell('Married',407,556,40),cell('',484,556,9),cell('Baby Care',515,270,48),cell('',487,283,9),cell('REMARKS',250,100,50),cell('FIT TO WORK',400,115,70)];
 const d=spatial(items);assert.equal(d.marital,'MARRIED');assert.equal(d.skills,'Baby Care');assert.equal(d.notes,'FIT TO WORK');assert.equal(finalizeData(d,textRows(items)).data.marital,'MARRIED');
});
test('age derives from a valid birth date only when no age was supplied',()=>{const birth='16 JAN 1996';const now=new Date();const expected=now.getUTCFullYear()-1996-(now.getUTCMonth()===0&&now.getUTCDate()<16?1:0);assert.equal(finalizeData({birthDate:birth},'').data.age,String(expected));assert.equal(finalizeData({birthDate:birth,age:'29'},'').data.age,'29');assert(!finalizeData({birthDate:'31/02/1996'},'').data.age);});

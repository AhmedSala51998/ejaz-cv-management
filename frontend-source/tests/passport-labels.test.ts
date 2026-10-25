import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseText,spatial,textRows,finalizeData} from '../lib/parser';
test('issued DFA and EXP labels work in neighboring CV columns',()=>{
 const cell=(str:string,x:number,y:number,width=75)=>({str,transform:[1,0,0,1,x,y],width,height:10});
 const items=[cell('BOUND TO',10,500),cell('KSA',110,500),cell('DFA',300,503.24,30),cell('DFA NCR WEST',380,500),cell('POST APPLIED FOR',10,480),cell('FAMILY DRIVER',110,480),cell('ISSUED',300,480,40),cell('JUL 15 2026',380,480),cell('MONTHLY SALARY',10,460),cell('450 USD',110,460),cell('EXP.',300,460,30),cell('JUL 14 2036',380,460)];
 const text=textRows(items),d=finalizeData({...parseText(text),...spatial(items)},text).data;
 assert.equal(d.issuePlace,'DFA NCR WEST');assert.equal(d.issueDate,'JUL 15 2026');assert.equal(d.expiryDate,'JUL 14 2036');assert.equal(d.job,'FAMILY DRIVER');
});
test('standalone headings retain dates and issue office',()=>{
 const d=parseText('DFA\nDFA NCR WEST\nISSUED\nJUL 15 2026\nEXP.\nJUL 14 2036');assert.equal(d.issuePlace,'DFA NCR WEST');assert.equal(d.issueDate,'JUL 15 2026');assert.equal(d.expiryDate,'JUL 14 2036');
});

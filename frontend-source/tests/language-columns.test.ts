import {test} from 'node:test';import assert from 'node:assert/strict';import {readLanguageColumns} from '../lib/language-columns';
const w=(text:string,x:number,y:number)=>({text,x,y,w:40,h:10});
const headers=[w('EVALUATTION',10,100),w('ENGLISH',110,100),w('ARABIC',210,100)];
const rows=[w('POOR',10,120),w('FAIR',10,140),w('GOOD',10,160)];
test('written ratings follow language columns, separate from the evaluation guide',()=>{const d=readLanguageColumns([...headers,...rows,w('FAIR',110,140),w('POOR',210,120)]);assert.deepEqual(d.values,{english:'FAIR',arabic:'POOR'});});
test('empty rating columns remain empty',()=>{assert.deepEqual(readLanguageColumns([...headers,...rows]).values,{});});
test('multiple or contradictory written ratings require review',()=>{const d=readLanguageColumns([...headers,...rows,w('FAIR',110,140),w('GOOD',110,160),w('GOOD',210,120)]);assert.deepEqual(d.values,{});assert.deepEqual(d.uncertain.sort(),['arabic','english']);});
test('language columns may be reversed and coordinates scaled',()=>{const d=readLanguageColumns([...headers.map(a=>({...a,text:a.text==='ENGLISH'?'ARABIC':a.text==='ARABIC'?'ENGLISH':a.text})),...rows,w('FAIR',110,140),w('POOR',210,120)].map(a=>({...a,x:a.x*3,y:a.y*3,w:a.w*3,h:a.h*3})));assert.deepEqual(d.values,{arabic:'FAIR',english:'POOR'});});

// Validate the entire cell, not the presence of any digit in OCR text.
export function validMeasurement(key:'height'|'weight',input:string){
 const value=input.normalize('NFKC').replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776))).trim();
 if(key==='weight'){const m=value.match(/^(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|kgs|kilograms?|كجم|كغ|كيلو(?:جرام)?)?$/i);return !!m&&+m[1].replace(',','.')>=25&&+m[1].replace(',','.')<=250;}
 const combined=value.match(/^(\d{3}(?:[.,]\d{1,2})?)\s*cm\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*kg$/i);
 if(combined)return validMeasurement('height',combined[1]+' cm')&&validMeasurement('weight',combined[2]+' kg');
 const feet=value.match(/^([3-7])\s*(?:feet|foot|ft|fit|')\s*(\d{1,2})?\s*(?:inches|inch|in|")?$/i)||value.match(/^([3-7])[.,](\d{1,2})$/);
 if(feet)return +(feet[2]||0)<12;
 const m=value.match(/^(\d{1,3}(?:[.,]\d{1,2})?)\s*(cm|cms|centimeters?|سم|m|meters?|متر)?$/i);if(!m)return false;
 const n=+m[1].replace(',','.');return /^(?:m|meters?|متر)$/i.test(m[2]||'')?n>=1&&n<=2.5:/^(?:cm|cms|centimeters?|سم)$/i.test(m[2]||'')?n>=100&&n<=250:(n>=100&&n<=250||n>=1&&n<=2.5);
}

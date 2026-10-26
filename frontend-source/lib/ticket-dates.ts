export function displayTicketDate(value:string):string {
 return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('-'):value;
}
export function inputTicketDate(value:string):string {
 const m=value.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
 if(!m)return value.trim();
 const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return value.trim();
 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function validTicketDate(value:string):boolean{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}

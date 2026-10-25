export function photoPageKind(text:string):'profile'|'passport'|'uncertain'{
 if(/personal information|full name|name in full|first name|position desired|post applied|curriculum|bio[ -]?data|worker[’']?s?\s+name|application for employ|details of candidate|job description|الاسم الكامل|تفاصيل التطبيق/i.test(text))return 'profile';
 return /P<[A-Z]{3}|passport|republic|جواز|date de naissance|nationality/i.test(text)?'passport':'uncertain';
}
export function orderPhotos<T extends {src:string;kind?:string;fullBody?:boolean}>(photos:T[]):T[]{
 const rank=(p:T)=>(p.kind==='profile'?0:p.kind==='passport'?10:20)+(p.fullBody?0:1);
 const seen=new Set<string>();return [...photos].sort((a,b)=>rank(a)-rank(b)).filter(p=>{if(seen.has(p.src))return false;seen.add(p.src);return true;});
}

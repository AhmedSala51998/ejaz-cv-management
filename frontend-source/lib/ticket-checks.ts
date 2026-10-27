import {Ticket} from './ticket-parser';
export function essentialTicketWarnings(data:Ticket):string[]{
 const warnings:string[]=[];
 if(!data.passengers.length)warnings.push('اسم المسافر ورقم الجواز غير مقروءين؛ استكملهما من السيرة المطابقة أو الأصل.');
 data.passengers.forEach((p,i)=>{if(!p.name)warnings.push('المسافر '+(i+1)+': الاسم غير مقروء.');if(!p.passport)warnings.push('المسافر '+(i+1)+': رقم الجواز غير موجود أو غير مقروء؛ ابحث داخل المكتب والبلد.');});
 if(!data.segments.length)warnings.push('لم تُقرأ مراحل الرحلة؛ أدخلها من الأصل.');
 data.segments.forEach((s,i)=>{const missing=[['flightNumber','رقم الرحلة'],['from','مدينة المغادرة'],['to','مدينة الوصول'],['departureDate','تاريخ المغادرة'],['departureTime','وقت المغادرة'],['arrivalDate','تاريخ الوصول'],['arrivalTime','وقت الوصول']].filter(([k])=>!(s as any)[k]).map(([,label])=>label);if(!s.airline&&!data.airline)missing.push('شركة الطيران / الناقل');if(missing.length)warnings.push('المرحلة '+(i+1)+' — راجع: '+missing.join('، '));});
 return warnings;
}

import {useRef} from 'react';
import {CalendarDays} from 'lucide-react';
import {displayTicketDate,inputTicketDate,validTicketDate} from '@/lib/ticket-dates';

export default function TicketDateInput({value,label,onChange}:{value:string;label:string;onChange:(value:string)=>void}){
 const picker=useRef<HTMLInputElement>(null);
 const valid=!value||validTicketDate(value);
 return <span className="ticket-date-field">
  <span className="ticket-date-control" dir="ltr">
   <input aria-label={label} type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} value={displayTicketDate(value)} onChange={e=>onChange(inputTicketDate(e.target.value))} aria-invalid={!valid}/>
   <button type="button" aria-label={'اختيار '+label+' من التقويم'} onClick={()=>{const el=picker.current;if(!el)return;if(el.showPicker)el.showPicker();else{el.focus();el.click();}}}><CalendarDays size={18}/></button>
   <input ref={picker} className="ticket-native-date" aria-label={label+' — التقويم'} tabIndex={-1} type="date" value={valid?value:''} onChange={e=>onChange(e.target.value)}/>
  </span>
  <small className="ticket-date-hint">يوم-شهر-سنة{valid&&value?' · '+new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):''}</small>
 </span>;
}

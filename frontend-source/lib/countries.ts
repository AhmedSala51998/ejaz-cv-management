export const countries=[
 {value:'ETHIOPIAN',label:'إثيوبيا',active:true,pattern:/\bETHIOPIA(?:N)?\b|اثيوبيا|إثيوبيا/i},
 {value:'UGANDAN',label:'أوغندا',active:false,pattern:/\bUGANDA(?:N)?\b|اوغندا|أوغندا/i},
 {value:'FILIPINO',label:'الفلبين',active:true,pattern:/\bFILIPIN[OA]|\bPHILIPPINES?\b|الفلبين/i},
 {value:'SRI LANKAN',label:'سريلانكا',active:true,pattern:/\bSRI\s*LANKA(?:N)?\b|سريلانكا/i},
 {value:'INDIAN',label:'الهند',active:true,pattern:/\bINDIA(?:N)?\b|الهند/i},
 {value:'BURUNDIAN',label:'بوروندي',active:true,pattern:/\bBURUNDI(?:AN)?\b|بوروندي|بروندي/i},
 {value:'KENYAN',label:'كينيا',active:true,pattern:/\bKENYA(?:N)?\b|كينيا/i},
 {value:'BANGLADESHI',label:'بنغلاديش',active:true,pattern:/\bBANGLADESH(?:I)?\b|بنغلاديش|بنجلاديش/i},
 {value:'SOMALI',label:'الصومال',active:true,pattern:/\bSOMALI(?:A|AN)?\b|الصومال/i},
] as const;
export function normalizeNationality(value:string){const clean=value.normalize('NFKC').replace(/[\u064b-\u065f\u0640]/g,'');return countries.find(c=>c.pattern.test(clean))?.value||'';}
export function labeledNationality(text:string){const lines=text.split('\n');for(let i=0;i<lines.length;i++){const clean=lines[i].normalize('NFKC').replace(/[\u064b-\u065f\u0640]/g,'');if(!/nationality|الجنسية/i.test(clean))continue;for(const line of [lines[i],lines[i-1]||'',lines[i+1]||'']){const value=normalizeNationality(line);if(value)return value;}}return '';}

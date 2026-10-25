export function shouldUseReviewedSkills(native:string|undefined,reviewed:string|undefined,needsOCR:boolean,verified:boolean){
 return !!reviewed?.trim()&&(needsOCR||!native?.trim()||verified);
}

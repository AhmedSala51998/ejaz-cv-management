<?php
declare(strict_types=1);
function office_country(string $value): string {
    $patterns=['ETHIOPIAN'=>'/ethiopia|اثيوبيا|إثيوبيا/i','UGANDAN'=>'/uganda|اوغندا|أوغندا/i','FILIPINO'=>'/filipin|philippin|الفلبين/i','SRI LANKAN'=>'/sri\s*lanka|سريلانكا/i','INDIAN'=>'/india|الهند/i','BURUNDIAN'=>'/burundi|بوروندي|بروندي/i','KENYAN'=>'/kenya|كينيا/i','BANGLADESHI'=>'/bangladesh|بنغلاديش|بنجلاديش/i','SOMALI'=>'/somali|الصومال/i'];
    foreach($patterns as $key=>$pattern)if(preg_match($pattern,$value))return $key;
    return strtoupper(trim($value));
}
function office_valid_country(string $value): string {
    $country=office_country($value);
    if(!in_array($country,['ETHIOPIAN','UGANDAN','FILIPINO','SRI LANKAN','INDIAN','BURUNDIAN','KENYAN','BANGLADESHI','SOMALI'],true))json_response(['error'=>'اختر بلد المكتب من القائمة أو اكتب بلدًا معتمدًا بجوار الاسم.'],400);
    return $country;
}
function office_name_key(string $name): string {
    $name=strtoupper(trim($name));
    $name=preg_replace('/\b(MRS|MISS|MS|MR|MSTR|MST|DR)\b/u',' ',$name);
    $tokens=preg_split('/[^\p{L}\p{N}]+/u',$name,-1,PREG_SPLIT_NO_EMPTY);sort($tokens,SORT_STRING);return implode(' ',$tokens);
}
function office_get(PDO $db,string $owner,string $id): ?array {
    return one($db,'SELECT id,name,country,active FROM recruitment_offices WHERE owner=? AND id=?',[$owner,$id])?:null;
}
function ticket_office_context(PDO $db,string $owner,array $data,bool $required=false,bool $active=false): array {
    $id=(string)($data['officeId']??'');
    if($id===''){if($required)json_response(['error'=>'اختر مكتب الاستقدام أولًا.'],400);return $data;}
    $office=office_get($db,$owner,$id);
    if(!$office)json_response(['error'=>'المكتب غير موجود في مساحة عملك.'],400);
    if($active&&!(int)$office['active'])json_response(['error'=>'المكتب معطل؛ اختر مكتبًا نشطًا.'],400);
    if(trim((string)$office['country'])==='')json_response(['error'=>'حدد بلد المكتب من صفحة مكاتب الاستقدام قبل رفع أو حفظ التذاكر.'],400);
    $country=office_valid_country((string)$office['country']);
    $submitted=trim((string)($data['sourceCountry']??''));
    if($submitted!==''&&office_country($submitted)!==$country)json_response(['error'=>'بلد التذكرة يجب أن يطابق بلد المكتب. حدّث بيانات المكتب في النموذج وأعد المراجعة.'],409);
    $data['officeName']=$office['name'];$data['sourceCountry']=$country;return $data;
}
function office_candidates(PDO $db,string $owner,array $input): array {
    $input=ticket_office_context($db,$owner,$input,true);$office=(string)$input['officeId'];$country=$input['sourceCountry'];
    if(!$office||!$country||!office_get($db,$owner,$office))return [];
    $rows=query($db,'SELECT r.id,r.name,r.passport,r.nationality FROM records r JOIN office_records l ON l.record_id=r.id AND l.owner=r.owner WHERE r.owner=? AND l.office_id=? ORDER BY r.name,r.id',[$owner,$office])->fetchAll();
    $rows=array_values(array_filter($rows,fn($r)=>office_country($r['nationality'])===$country));
    $out=[];$people=$input['passengers']??[];
    foreach($people as $i=>$person){
        $name=trim((string)($person['name']??''));$pass=passport((string)($person['passport']??''));$key=office_name_key($name);
        $candidates=array_values(array_filter($rows,fn($r)=>$pass!==''?$r['passport']===$pass:($key!==''?office_name_key($r['name'])===$key:true)));
        // No fuzzy identity guesses. Missing both identifiers always requires a choice.
        $out[]=['index'=>$i,'unique'=>count($candidates)===1&&($pass!==''||$key!==''),'candidates'=>array_slice($candidates,0,50),'total'=>count($candidates)];
    }
    return $out;
}
function offices_routes(PDO $db,string $owner,string $resource,string $method): void {
    if(!in_array($resource,['offices','offices/bulk','offices/records','offices/assign-bulk','tickets/resolve'],true))return;
    if($resource==='offices/bulk'){
        if($method!=='POST')json_response(['error'=>'طريقة غير مدعومة.'],405);
        need_action('manage');$b=read_json();$names=$b['names']??null;
        if(!is_array($names)||!count($names)||count($names)>500)json_response(['error'=>'أرسل من 1 إلى 500 اسم مكتب، كل مكتب في سطر.'],400);
        $clean=[];foreach($names as $line){if(!is_string($line))json_response(['error'=>'بيانات غير صالحة.'],400);$parts=explode('|',$line,2);$name=trim($parts[0]);if($name===''||cut_text($name,200)!==$name)json_response(['error'=>'كل اسم مكتب مطلوب وبحد أقصى 200 حرف. لم تتم إضافة الدفعة.'],400);$country=office_valid_country((string)($parts[1]??$b['country']??''));$clean[]=[$name,$country];}
        $db->beginTransaction();$added=0;$skipped=0;$now=now_iso();
        foreach($clean as [$name,$country]){$row=query($db,'INSERT INTO recruitment_offices(id,owner,name,country,active,version,created,updated) VALUES(?,?,?,?,1,1,?,?) ON DUPLICATE KEY UPDATE id=id',[uuid(),$owner,$name,$country,$now,$now]);if($row->rowCount()===1)$added++;else $skipped++;}
        audit_event($db,$owner,'office-bulk-create',null,'added='.$added.' skipped='.$skipped);$db->commit();
        json_response(['added'=>$added,'skipped'=>$skipped]);
    }
    if($resource==='offices/assign-bulk'){
        if($method!=='PUT')json_response(['error'=>'طريقة غير مدعومة.'],405);
        need_action('edit');$b=read_json();$id=(string)($b['officeId']??'');$office=office_get($db,$owner,$id);
        if(!$office||!(int)$office['active'])json_response(['error'=>'اختر مكتبًا نشطًا.'],400);
        $ids=$b['recordIds']??null;if(!is_array($ids)||!count($ids)||count($ids)>5000)json_response(['error'=>'حدد من 1 إلى 5000 سيرة في العملية.'],400);
        foreach($ids as $record)if(!is_string($record)||$record===''||strlen($record)>36)json_response(['error'=>'تحديد غير صالح.'],400);
        $ids=array_values(array_unique($ids));sort($ids,SORT_STRING);$db->beginTransaction();$assigned=0;$skipped=0;
        foreach($ids as $record){
            if(!one($db,'SELECT id FROM records WHERE id=? AND owner=? FOR UPDATE',[$record,$owner])){$db->rollBack();json_response(['error'=>'إحدى السير لم تعد موجودة في مساحة عملك؛ حدّث القائمة.'],409);}
            if(one($db,'SELECT record_id FROM office_records WHERE record_id=? AND owner=?',[$record,$owner])){$skipped++;continue;}
            query($db,'INSERT INTO office_records(record_id,owner,office_id,created) VALUES(?,?,?,?)',[$record,$owner,$id,now_iso()]);$assigned++;
        }
        audit_event($db,$owner,'office-bulk',null,$id.' assigned='.$assigned.' skipped='.$skipped);$db->commit();
        json_response(['assigned'=>$assigned,'skipped'=>$skipped]);
    }
    if($resource==='tickets/resolve'){
        if($method!=='POST')json_response(['error'=>'طريقة غير مدعومة.'],405);
        $input=read_json();if(!is_array($input['passengers']??null)||count($input['passengers'])>100)json_response(['error'=>'بيانات غير صالحة.'],400);
        json_response(['results'=>office_candidates($db,$owner,$input)]);
    }
    if($resource==='offices'){
        if($method==='GET')json_response(['offices'=>query($db,'SELECT o.id,o.name,o.country,o.active,o.version,COUNT(l.record_id) AS records_count FROM recruitment_offices o LEFT JOIN office_records l ON l.office_id=o.id AND l.owner=o.owner WHERE o.owner=? GROUP BY o.id,o.name,o.country,o.active,o.version ORDER BY o.name',[$owner])->fetchAll()]);
        need_action('manage');$b=read_json();$name=cut_text(is_scalar($b['name']??null)?(string)$b['name']:'',200);
        if(!in_array($method,['POST','PUT'],true))json_response(['error'=>'طريقة غير مدعومة.'],405);
        $country=office_valid_country((string)($b['country']??''));
        if(!$name)json_response(['error'=>'اسم المكتب مطلوب.'],400);
        $now=now_iso();$id=$method==='POST'?uuid():(string)($b['id']??'');
        if(one($db,'SELECT id FROM recruitment_offices WHERE owner=? AND name=? AND id<>?',[$owner,$name,$id]))json_response(['error'=>'اسم المكتب موجود بالفعل.'],409);
        if($method==='POST')query($db,'INSERT INTO recruitment_offices(id,owner,name,country,active,version,created,updated) VALUES(?,?,?,?,1,1,?,?)',[$id,$owner,$name,$country,$now,$now]);
        else {
            $s=query($db,'UPDATE recruitment_offices SET name=?,country=?,active=?,updated=?,version=version+1 WHERE id=? AND owner=? AND version=?',[$name,$country,!empty($b['active'])?1:0,$now,$id,$owner,(int)($b['version']??0)]);
            if(!$s->rowCount())json_response(['error'=>'تم تعديل المكتب؛ حدّث القائمة وأعد المحاولة.'],409);
        }
        audit_event($db,$owner,'office',null,$id.' '.$name);json_response(['ok'=>true,'id'=>$id]);
    }
    $id=(string)($_GET['officeId']??'');
    if($method==='GET'){
        if(!office_get($db,$owner,$id))json_response(['error'=>'المكتب غير موجود.'],404);
        $q=cut_text((string)($_GET['q']??''),100);$page=max(1,(int)($_GET['page']??1));
        $where='r.owner=? AND (r.name LIKE ? OR r.passport LIKE ? OR r.nationality LIKE ?)';$params=[$owner,'%'.$q.'%','%'.$q.'%','%'.$q.'%'];
        $n=(int)one($db,'SELECT COUNT(*) AS n FROM records r WHERE '.$where,$params)['n'];
        $rows=query($db,'SELECT r.id,r.name,r.passport,r.nationality,COALESCE(l.office_id,\'\') AS office_id FROM records r LEFT JOIN office_records l ON l.record_id=r.id AND l.owner=r.owner WHERE '.$where.' ORDER BY r.name,r.id LIMIT 25 OFFSET '.(($page-1)*25),$params)->fetchAll();
        json_response(['records'=>$rows,'pages'=>max(1,(int)ceil($n/25))]);
    }
    if($method!=='PUT')json_response(['error'=>'طريقة غير مدعومة.'],405);
    need_action('edit');$b=read_json();$id=(string)($b['officeId']??'');$record=(string)($b['recordId']??'');
    if(!office_get($db,$owner,$id)||!one($db,'SELECT id FROM records WHERE id=? AND owner=?',[$record,$owner]))json_response(['error'=>'المكتب أو السيرة غير موجود.'],404);
    if(!empty($b['assigned']))query($db,'INSERT INTO office_records(record_id,owner,office_id,created) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE office_id=VALUES(office_id)',[$record,$owner,$id,now_iso()]);
    else query($db,'DELETE FROM office_records WHERE record_id=? AND owner=? AND office_id=?',[$record,$owner,$id]);
    audit_event($db,$owner,'office-record',$record,$id);json_response(['ok'=>true]);
}

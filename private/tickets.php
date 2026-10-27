<?php
declare(strict_types=1);

function clean_ticket(array $input): array
{
    $clean=[];
    foreach (['officeId'=>36,'officeName'=>200,'sourceCountry'=>100,'bookingReference'=>100,'ticketNumber'=>100,'airline'=>200,'agency'=>300,'issueDate'=>10,'bookingDate'=>10,'status'=>100,'currency'=>3,'baseFare'=>30,'taxes'=>30,'total'=>30,'paymentMethod'=>100,'contactEmail'=>200,'contactPhone'=>100,'notes'=>8000,'extractedText'=>200000,'extractionMethod'=>100] as $key=>$limit) {
        $clean[$key]=cut_text(is_scalar($input[$key]??'')?(string)($input[$key]??''):'',$limit);
    }
    foreach (['issueDate','bookingDate'] as $key) ticket_date($clean[$key]);
    foreach (['baseFare','taxes','total'] as $key) if($clean[$key]!==''&&!preg_match('/^\d{1,12}(?:\.\d{1,2})?$/',$clean[$key]))json_response(['error'=>'راجع المبالغ المالية؛ استخدم أرقامًا موجبة وبحد أقصى منزلتين عشريتين.'],400);
    if($clean['currency']!==''&&!preg_match('/^[A-Z]{3}$/',$clean['currency']))json_response(['error'=>'رمز العملة يجب أن يكون 3 حروف إنجليزية كبيرة.'],400);
    foreach (['passengers'=>['cvRecordId'=>36,'identitySource'=>300,'checkedBaggage'=>300,'cabinBaggage'=>300,'personalItem'=>300,'frequentFlyer'=>100,'name'=>200,'passport'=>40,'ticketNumber'=>100,'nationality'=>100,'birthDate'=>10,'type'=>50,'baggage'=>200,'seat'=>100,'meal'=>200],'segments'=>['checkedBaggage'=>300,'cabinBaggage'=>300,'personalItem'=>300,'meal'=>200,'stops'=>100,'checkInDeadline'=>100,'fareFamily'=>100,'notValidBefore'=>100,'notValidAfter'=>100,'airline'=>200,'flightNumber'=>30,'from'=>200,'to'=>200,'departureDate'=>10,'departureTime'=>5,'arrivalDate'=>10,'arrivalTime'=>5,'departureTerminal'=>100,'arrivalTerminal'=>100,'cabin'=>100,'bookingClass'=>50,'baggage'=>200,'seat'=>100,'status'=>100,'duration'=>100,'aircraft'=>100,'airlineReference'=>100,'fareBasis'=>100,'notes'=>3000],'additional'=>['label'=>150,'value'=>3000]] as $group=>$fields) {
        $rows=$input[$group]??[];
        if(!is_array($rows)||count($rows)>($group==='segments'?30:($group==='additional'?500:100)))json_response(['error'=>'عدد المسافرين أو الرحلات أو البيانات الإضافية غير صالح.'],400);
        $clean[$group]=[];
        foreach($rows as $row) {
            if(!is_array($row))json_response(['error'=>'بيانات التذكرة غير صالحة.'],400);
            $item=[];foreach($fields as $key=>$limit){$item[$key]=cut_text(is_scalar($row[$key]??'')?(string)($row[$key]??''):'',$limit);if(str_ends_with($key,'Date'))ticket_date($item[$key]);if(str_ends_with($key,'Time')&&$item[$key]!==''&&!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$item[$key]))json_response(['error'=>'وقت الرحلة غير صالح.'],400);}
            if(isset($item['passport'])){$item['passport']=passport($item['passport']);if($item['passport']!==''&&!preg_match('/^[A-Z0-9]{5,20}$/',$item['passport']))json_response(['error'=>'راجع رقم الجواز.'],400);}
            if($group==='passengers'&&$item['name']==='')json_response(['error'=>'اسم كل مسافر مطلوب.'],400);
            $clean[$group][]=$item;
        }
    }
    if(!$clean['passengers'])json_response(['error'=>'أضف مسافرًا واحدًا على الأقل.'],400);
    if(!$clean['segments'])json_response(['error'=>'أضف مرحلة رحلة واحدة على الأقل وراجع البيانات.'],400);
    foreach($clean['segments'] as $s){if(!$s['from']||!$s['to'])json_response(['error'=>'مكان المغادرة والوصول مطلوب لكل مرحلة.'],400);if($s['departureDate']&&$s['arrivalDate']&&$s['arrivalDate']<$s['departureDate'])json_response(['error'=>'تاريخ الوصول لا يمكن أن يسبق تاريخ المغادرة.'],400);}
    return $clean;
}
function ticket_date(string $date): void
{
    if($date==='')return;
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
    if(!$d||$d->format('Y-m-d')!==$date)json_response(['error'=>'أحد التواريخ غير صالح.'],400);
}
function ticket_matches(PDO $db,string $owner,array $data): array
{
    $matches=[];
    foreach($data['passengers']??[] as $person){$p=passport((string)($person['passport']??''));if($p==='')continue;
        $row=one($db,'SELECT id,name,passport FROM records WHERE owner=? AND passport=?',[$owner,$p]);
        if($row)$matches[]=$row;
    }
    return $matches;
}
function ticket_public(PDO $db,string $owner,array $row): array
{
    unset($row['original_data']);$row['data']=json_decode($row['data'],true)?:[];$row['version']=(int)$row['version'];$row['reviewed']=(bool)$row['reviewed'];$row['matches']=ticket_matches($db,$owner,$row['data']);return $row;
}
function tickets_routes(PDO $db,string $owner,string $resource,string $method): void
{
    if(!in_array($resource,['tickets','tickets/file','tickets/match'],true))return;
    if(!one($db,"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tickets'"))json_response(['error'=>'استورد ملف database/tickets-upgrade.sql مرة واحدة لتفعيل قسم التذاكر.'],503);
    if($resource==='tickets/match'&&$method==='GET')json_response(['matches'=>ticket_matches($db,$owner,['passengers'=>[['passport'=>$_GET['passport']??'']]])]);
    if($resource==='tickets/file'&&$method==='GET'){
        $row=one($db,'SELECT filename,mime,original_data FROM tickets WHERE id=? AND owner=?',[(string)($_GET['id']??''),$owner]);
        if(!$row)json_response(['error'=>'التذكرة غير موجودة.'],404);
        header('Content-Type: '.$row['mime']);header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header("Content-Disposition: inline; filename*=UTF-8''".rawurlencode($row['filename']));echo $row['original_data'];exit;
    }
    if($resource!=='tickets')json_response(['error'=>'طريقة الطلب غير مدعومة.'],405);
    if($method==='GET'){
        $id=(string)($_GET['id']??'');
        if($id!==''){$row=one($db,'SELECT id,owner,booking_reference,ticket_number,passenger_name,passport,airline,departure_date,arrival_date,origin,destination,data,filename,mime,file_hash,reviewed,created,updated,version FROM tickets WHERE id=? AND owner=?',[$id,$owner]);if(!$row)json_response(['error'=>'التذكرة غير موجودة.'],404);json_response(['ticket'=>ticket_public($db,$owner,$row)]);}
        $q=cut_text((string)($_GET['q']??''),200);$page=max(1,(int)($_GET['page']??1));$limit=25;$where='owner=?';$params=[$owner];
        $officeFilter=(string)($_GET['officeId']??'');if($officeFilter!==''){$where.=" AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.officeId'))=?";$params[]=$officeFilter;}
        if($q!==''){$where.=' AND (passenger_name LIKE ? OR passport LIKE ? OR booking_reference LIKE ? OR ticket_number LIKE ? OR data LIKE ?)';for($i=0;$i<5;$i++)$params[]='%'.$q.'%';}
        $count=(int)one($db,'SELECT COUNT(*) AS n FROM tickets WHERE '.$where,$params)['n'];
        $list=query($db,'SELECT id,booking_reference,ticket_number,passenger_name,passport,airline,departure_date,arrival_date,origin,destination,JSON_UNQUOTE(JSON_EXTRACT(data,\'$.officeName\')) AS office_name,filename,updated,version FROM tickets WHERE '.$where.' ORDER BY updated DESC,id DESC LIMIT 25 OFFSET '.(($page-1)*$limit),$params)->fetchAll();json_response(['tickets'=>$list,'total'=>$count,'page'=>$page,'pages'=>max(1,(int)ceil($count/$limit))]);
    }
    if($method==='POST'||$method==='PUT'){
        need_action($method==='POST'?'create':'edit');
        $body=$method==='POST'?json_decode((string)($_POST['data']??''),true):read_json();
        if(!is_array($body))json_response(['error'=>'بيانات التذكرة غير صالحة.'],400);
        if(($method==='POST'?($_POST['reviewed']??''):($body['reviewed']??''))!=='yes')json_response(['error'=>'راجع بيانات التذكرة وأكّد صحتها قبل الحفظ.'],400);
        $ticket_input=$method==='PUT'?($body['data']??[]):$body;if(!is_array($ticket_input))json_response(['error'=>'بيانات التذكرة غير صالحة.'],400);$clean=clean_ticket($ticket_input);$officeId=$clean['officeId'];
        $clean=ticket_office_context($db,$owner,$clean,$method==='POST',$method==='POST');
        foreach($clean['passengers'] as &$person){
            if(!$person['cvRecordId'])continue;
            $cv=one($db,'SELECT r.id,r.name,r.passport,r.nationality FROM records r JOIN office_records l ON l.record_id=r.id AND l.owner=r.owner WHERE r.id=? AND r.owner=? AND l.office_id=?',[$person['cvRecordId'],$owner,$officeId]);
            if(!$cv||office_country($cv['nationality'])!==office_country($clean['sourceCountry'])||$cv['passport']!==$person['passport'])json_response(['error'=>'ارتباط السيرة لا يطابق المكتب والبلد والجواز؛ أعد اختيار السيرة.'],400);
            $person['identitySource']='CV: '.$cv['id'];
        }unset($person);
        $encoded=json_encode($clean,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);$now=now_iso();
        $people=$clean['passengers'];$first=$clean['segments'][0];$last=$clean['segments'][count($clean['segments'])-1];
        $summary=[$clean['bookingReference'],$clean['ticketNumber']?:$people[0]['ticketNumber'],implode(' / ',array_column($people,'name')),$people[0]['passport'],$clean['airline'],$first['departureDate']?:null,$last['arrivalDate']?:null,$first['from'],$last['to'],$encoded,$now];
        if($method==='POST'){
            $file=uploaded('file',25*1024*1024);if(!$file)json_response(['error'=>'ارفع أصل التذكرة PDF أو صورة.'],400);
            $bytes=file_get_contents($file['tmp_name']);$name=cut_text(basename($file['name']),1000);$ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));$image=@getimagesizefromstring($bytes);
            $mime=$ext==='pdf'&&str_starts_with($bytes,'%PDF-')?'application/pdf':(in_array($ext,['jpg','jpeg','png','webp'],true)&&$image&&in_array($image['mime'],['image/jpeg','image/png','image/webp'],true)?$image['mime']:'');
            if(!$mime)json_response(['error'=>'محتوى الملف لا يطابق PDF أو صورة مدعومة.'],400);
            check_binary_packet($db,strlen($bytes));$hash=hash('sha256',$bytes);$existing=one($db,'SELECT id FROM tickets WHERE owner=? AND file_hash=?',[$owner,$hash]);if($existing)json_response(['error'=>'هذا الملف محفوظ بالفعل. افتح التذكرة الموجودة للتعديل.','existingId'=>$existing['id']],409);
            $id=uuid();$db->beginTransaction();query($db,'INSERT INTO tickets(booking_reference,ticket_number,passenger_name,passport,airline,departure_date,arrival_date,origin,destination,data,updated,id,owner,filename,mime,original_data,file_hash,reviewed,created,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,1)',[...$summary,$id,$owner,$name,$mime,$bytes,$hash,$now]);audit_event($db,$owner,'ticket-create',null,$id.' '.$name);$db->commit();
        }else{
            $id=(string)($body['id']??'');$db->beginTransaction();$old=one($db,'SELECT version FROM tickets WHERE id=? AND owner=? FOR UPDATE',[$id,$owner]);if(!$old){$db->rollBack();json_response(['error'=>'التذكرة غير موجودة.'],404);}if((int)($body['version']??0)!==(int)$old['version']){$db->rollBack();json_response(['error'=>'تم تعديل التذكرة من جلسة أخرى؛ حدّثها قبل الحفظ.'],409);}
            query($db,'UPDATE tickets SET booking_reference=?,ticket_number=?,passenger_name=?,passport=?,airline=?,departure_date=?,arrival_date=?,origin=?,destination=?,data=?,updated=?,reviewed=1,version=version+1 WHERE id=? AND owner=?',[...$summary,$id,$owner]);audit_event($db,$owner,'ticket-edit',null,$id);$db->commit();
        }
        json_response(['ok'=>true,'id'=>$id,'matches'=>ticket_matches($db,$owner,$clean)]);
    }
    if($method==='DELETE'){
        need_action('manage');$body=read_json();$id=(string)($body['id']??'');$db->beginTransaction();$old=one($db,'SELECT version FROM tickets WHERE id=? AND owner=? FOR UPDATE',[$id,$owner]);if(!$old){$db->rollBack();json_response(['error'=>'التذكرة غير موجودة.'],404);}if((int)($body['version']??0)!==(int)$old['version']){$db->rollBack();json_response(['error'=>'تم تعديل التذكرة؛ حدّثها قبل الحذف.'],409);}query($db,'DELETE FROM tickets WHERE id=? AND owner=?',[$id,$owner]);audit_event($db,$owner,'ticket-delete',null,$id);$db->commit();json_response(['ok'=>true]);
    }
    json_response(['error'=>'طريقة الطلب غير مدعومة.'],405);
}

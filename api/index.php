<?php
declare(strict_types=1);
ini_set('display_errors','0');
require dirname(__DIR__).'/private/bootstrap.php';
$resource=trim((string)($_GET['resource']??preg_replace('~^.*?/api/~','',parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH))),'/');
$method=$_SERVER['REQUEST_METHOD']??'GET';
try {
    if(configuration())workspace_schema(database());
    if($resource==='auth/login' && $method==='POST') {
        if(!configuration())json_response(['error'=>'افتح صفحة التثبيت أولًا.'],503);
        if(!csrf_valid($_SERVER['HTTP_X_CSRF_TOKEN']??null))json_response(['error'=>'حدّث صفحة الدخول وأعد المحاولة.'],403);
        $body=read_json();$c=configuration();$db=database();$ip=hash('sha256',(string)($_SERVER['REMOTE_ADDR']??'local'));$time=time();
        query($db,'DELETE FROM login_attempts WHERE window_until<?',[$time]);
        $db->beginTransaction();
        query($db,'INSERT INTO login_attempts(ip_hash,attempts,window_until) VALUES(?,0,?) ON DUPLICATE KEY UPDATE ip_hash=VALUES(ip_hash)',[$ip,$time+900]);
        $attempt=one($db,'SELECT * FROM login_attempts WHERE ip_hash=? FOR UPDATE',[$ip]);
        if((int)$attempt['attempts']>=8){$db->commit();json_response(['error'=>'محاولات كثيرة؛ حاول بعد 15 دقيقة.'],429);}
        $validPassword=password_verify(substr((string)($body['password']??''),0,1024),$c['admin_password_hash']);
        $validUser=hash_equals($c['admin_username'],substr((string)($body['username']??''),0,128));
        $staff=null;if(!$validPassword||!$validUser){$staff=one($db,'SELECT * FROM staff_accounts WHERE username=? AND owner=? AND active=1',[substr((string)($body['username']??''),0,128),$c['owner_id']??'ejaz-admin']);if($staff&&password_verify(substr((string)($body['password']??''),0,1024),$staff['password_hash'])){$validPassword=true;$validUser=true;}else $staff=null;}
        if(!$validPassword||!$validUser){query($db,'UPDATE login_attempts SET attempts=attempts+1 WHERE ip_hash=?',[$ip]);$db->commit();json_response(['error'=>'اسم المستخدم أو كلمة المرور غير صحيحة.'],401);}
        query($db,'DELETE FROM login_attempts WHERE ip_hash=?',[$ip]);$db->commit();session_regenerate_id(true);
        unset($_SESSION['staff_id'],$_SESSION['staff_version']);if($staff){$_SESSION['staff_id']=$staff['id'];$_SESSION['staff_version']=(int)$staff['version'];}
        $_SESSION['authenticated']=true;$_SESSION['expires']=time()+86400;$_SESSION['auth_version']=$c['auth_version'];
        json_response(['ok'=>true]);
    }
    $owner=guard_api(!in_array($method,['GET','HEAD'],true));
    if($resource==='auth/logout'&&$method==='POST'){start_session();$_SESSION=[];session_destroy();json_response(['ok'=>true]);}
    $db=database();actor_info();need_action('view');
    require_once dirname(__DIR__).'/private/tickets.php';
    workspace_routes($db,$owner,$resource,$method);
    tickets_routes($db,$owner,$resource,$method);
    if($resource==='registry'&&$method==='GET') {
        $p=passport((string)($_GET['passport']??''));
        json_response(['count'=>(int)(one($db,'SELECT COUNT(*) AS count FROM registry WHERE owner=?',[$owner])['count']??0),
        'registered'=>$p?one($db,'SELECT name,passport FROM registry WHERE owner=? AND passport=?',[$owner,$p]):null,
        'existing'=>$p?one($db,'SELECT id,name,passport,updated FROM records WHERE owner=? AND passport=?',[$owner,$p]):null]);
    }
    if($resource==='registry'&&$method==='POST') {
        need_action('manage');
        $body=read_json();$rows=$body['rows']??null;
        if(!is_array($rows)||!count($rows)||count($rows)>1000)json_response(['error'=>'أرسل من 1 إلى 1000 جواز في الدفعة.'],400);
        $clean=[];foreach($rows as$row){$p=passport((string)($row['passport']??''));if(!preg_match('/^[A-Z0-9]{5,20}$/',$p))json_response(['error'=>'يوجد رقم جواز غير صالح.'],400);$clean[]=[$p,cut_text((string)($row['name']??''),200)];}
        $db->beginTransaction();foreach($clean as[$p,$name])query($db,'INSERT INTO registry(id,owner,passport,name,created) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[uuid(),$owner,$p,$name,now_iso()]);$db->commit();json_response(['count'=>count($clean)]);
    }
    if($resource==='record'&&$method==='GET') {
        $row=one($db,'SELECT * FROM records WHERE id=? AND owner=?',[(string)($_GET['id']??''),$owner]);
        if(!$row)json_response(['error'=>'السجل غير موجود.'],404);
        $row['data']=json_decode($row['data'],true)?:new stdClass();$row['version']=(int)$row['version'];json_response(['record'=>$row]);
    }
    if($resource==='records'&&$method==='GET') {
        $records=query($db,'SELECT r.*,COALESCE(m.status,\'available\') AS workflow_status,COALESCE(m.note,\'\') AS workflow_note,CASE WHEN g.id IS NULL THEN 0 ELSE 1 END AS listed FROM records r LEFT JOIN record_meta m ON m.record_id=r.id AND m.owner=r.owner LEFT JOIN registry g ON r.owner=g.owner AND r.passport=g.passport WHERE r.owner=? ORDER BY r.updated DESC',[$owner])->fetchAll();
        foreach($records as&$row){$decoded=json_decode($row['data'],true)?:[];unset($decoded['extractedText'],$decoded['_evidence']);$row['data']=$decoded?:new stdClass();$row['version']=(int)$row['version'];$row['listed']=(int)$row['listed'];}unset($row);json_response(['records'=>$records]);
    }
    if($resource==='records'&&$method==='POST') {
        need_action('create');
        $input=json_decode((string)($_POST['data']??''),true);if(!is_array($input))json_response(['error'=>'بيانات السيرة غير صالحة.'],400);$clean=clean_cv($input);
        if(!$clean['name']||!preg_match('/^[A-Z0-9]{5,20}$/',$clean['passport']))json_response(['error'=>'راجع الاسم ورقم الجواز أولًا.'],400);
        $file=uploaded('file',25*1024*1024);if(!$file)json_response(['error'=>'ارفع الملف الأصلي PDF أو Word أو صورة.'],400);
        $name=cut_text(basename($file['name']),1000);$ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));$bytes=file_get_contents($file['tmp_name']);
        $imageInfo=@getimagesizefromstring($bytes);$imageValid=in_array($ext,['jpg','jpeg','png','webp'],true)&&$imageInfo&&in_array($imageInfo['mime'],['image/jpeg','image/png','image/webp'],true);
        $valid=$imageValid||($ext==='pdf'?str_starts_with($bytes,'%PDF-'):($ext==='docx'?str_starts_with($bytes,"PK") : ($ext==='doc'&&str_starts_with($bytes,"\xD0\xCF\x11\xE0"))));
        if(!$valid)json_response(['error'=>'محتوى الملف لا يطابق الصيغة المدعومة.'],400);
        $picture=photo_payload(uploaded('photo',1000000));$now=now_iso();$source=$owner.'/'.uuid().'.'.$ext;
        $mime=$imageValid?$imageInfo['mime']:($ext==='pdf'?'application/pdf':($ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/msword'));
        check_binary_packet($db,strlen($bytes));if($picture)check_binary_packet($db,strlen($picture['data']));
        $db->beginTransaction();$listed=(bool)one($db,'SELECT id FROM registry WHERE owner=? AND passport=?',[$owner,$clean['passport']]);
        $old=one($db,'SELECT * FROM records WHERE owner=? AND passport=? FOR UPDATE',[$owner,$clean['passport']]);
        if(!$listed&&($_POST['confirmArchive']??'')!=='yes'){$db->rollBack();json_response(['error'=>'أكّد حفظ السيرة في الأرشيف لعدم وجود الجواز في قائمة مساند المحلية.','requiresArchiveConfirmation'=>true],409);}
        if($old)need_action('edit');
        if($old&&($_POST['confirmUpdate']??'')!=='yes'){$db->rollBack();json_response(['error'=>'يوجد سجل بهذا الجواز؛ أكّد تحديثه أولًا.','conflict'=>true],409);}
        query($db,'INSERT INTO uploaded_files(file_key,mime,data,created) VALUES(?,?,?,?)',[$source,$mime,$bytes,$now]);
        $photo=$picture?store_photo($db,$owner,$picture,$now):($old['photo']??null);$id=$old['id']??uuid();$data=json_encode($clean,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
        if($old){history_row($db,$old,$now);query($db,'UPDATE records SET name=?,nationality=?,data=?,source=?,filename=?,photo=?,updated=?,version=version+1 WHERE id=? AND owner=?',[$clean['name'],$clean['nationality'],$data,$source,$name,$photo,$now,$id,$owner]);}
        else query($db,'INSERT INTO records(id,owner,passport,name,nationality,data,source,filename,photo,created,updated,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)',[$id,$owner,$clean['passport'],$clean['name'],$clean['nationality'],$data,$source,$name,$photo,$now,$now]);
        audit_event($db,$owner,$old?'replace':'create',$id,$name);$db->commit();json_response(['id'=>$id,'listed'=>$listed,'updated'=>(bool)$old,'message'=>$listed?'تم حفظ البيانات مقابل الجواز المطابق.':'تم الحفظ في الأرشيف: غير مدرجة في مساند حسب قائمتك المحلية.']);
    }
    if($resource==='records'&&$method==='PUT') {
        need_action('edit');
        $body=read_json();$db->beginTransaction();$old=one($db,'SELECT * FROM records WHERE id=? AND owner=? FOR UPDATE',[(string)($body['id']??''),$owner]);
        if(!$old){$db->rollBack();json_response(['error'=>'السجل غير موجود.'],404);}
        if((int)($body['version']??0)!==(int)$old['version']){$db->rollBack();json_response(['error'=>'تم تعديل السجل. حدّث الصفحة قبل الحفظ.'],409);}
        $clean=clean_cv(is_array($body['data']??null)?$body['data']:[]);$clean['passport']=$old['passport'];if(!$clean['name']){$db->rollBack();json_response(['error'=>'الاسم مطلوب.'],400);}
        $now=now_iso();history_row($db,$old,$now);query($db,'UPDATE records SET data=?,name=?,nationality=?,updated=?,version=version+1 WHERE id=? AND owner=?',[json_encode($clean,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE),$clean['name'],$clean['nationality'],$now,$old['id'],$owner]);audit_event($db,$owner,'edit',$old['id']);$db->commit();json_response(['success'=>true]);
    }
    if($resource==='photos'&&$method==='POST') {
        need_action('edit');
        $picture=photo_payload(uploaded('photo',1000000));if(!$picture)json_response(['error'=>'اختر صورة.'],400);
        check_binary_packet($db,strlen($picture['data']));
        $db->beginTransaction();$old=one($db,'SELECT * FROM records WHERE id=? AND owner=? FOR UPDATE',[(string)($_POST['id']??''),$owner]);
        if(!$old){$db->rollBack();json_response(['error'=>'السيرة غير موجودة.'],404);}
        if((int)($_POST['version']??0)!==(int)$old['version']){$db->rollBack();json_response(['error'=>'تم تعديل السيرة. حدّث الصفحة وأعد المحاولة.'],409);}
        $now=now_iso();$photo=store_photo($db,$owner,$picture,$now);history_row($db,$old,$now);query($db,'UPDATE records SET photo=?,updated=?,version=version+1 WHERE id=? AND owner=?',[$photo,$now,$old['id'],$owner]);audit_event($db,$owner,'photo',$old['id']);$db->commit();json_response(['photo'=>$photo,'version'=>(int)$old['version']+1,'updated'=>$now]);
    }
    if($resource==='files'&&$method==='GET') {
        $key=(string)($_GET['key']??'');$row=null;
        if(str_starts_with($key,'db:'))$row=one($db,'SELECT mime,data FROM photos WHERE id=? AND owner=?',[substr($key,3),$owner]);
        elseif(str_starts_with($key,$owner.'/'))$row=one($db,'SELECT mime,data FROM uploaded_files WHERE file_key=?',[$key]);
        if(!$row){http_response_code(404);exit('Not found');}
        header('Content-Type: '.$row['mime']);header('Content-Length: '.strlen($row['data']));header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');echo $row['data'];exit;
    }
    if($resource==='backup'&&$method==='GET') {
        need_action('manage');audit_event($db,$owner,'backup');
        require dirname(__DIR__).'/private/backup.php';export_backup($db,$owner);exit;
    }
    json_response(['error'=>'المسار أو طريقة الطلب غير مدعومة.'],404);
} catch(Throwable $e) {
    if(isset($db)&&$db instanceof PDO)safe_rollback($db);
    $code=$e instanceof PDOException?(int)($e->errorInfo[1]??$e->getCode()):'APP';error_log('Ejaz PHP error: code='.$code.'; SQLSTATE='.($e instanceof PDOException?($e->errorInfo[0]??$e->getCode()):'APP').'; file='.basename($e->getFile()).'; line='.$e->getLine());
    if($code===1062&&$resource==='workspace/staff')json_response(['error'=>'اسم الدخول مستخدم من قبل؛ اختر اسمًا آخر.'],409);
    if($resource==='workspace/restore'&&str_starts_with($e->getMessage(),'BACKUP_'))json_response(['error'=>'ملف النسخة الاحتياطية غير مكتمل أو غير صالح. لم تُحفظ تغييرات الاستعادة.'],400);
    if($code===1062)json_response(['error'=>'يوجد سجل بهذا الجواز. أعد المطابقة وأكّد التحديث.','conflict'=>true],409);
    if($code===1213)json_response(['error'=>'تم حفظ متزامن؛ حدّث الصفحة وأعد المحاولة.'],409);
    if(in_array($code,[2006,2013,1153],true))json_response(['error'=>'انقطع اتصال MySQL أثناء العملية. راجع تشغيل MySQL وحد max_allowed_packet؛ في XAMPP اضبطه إلى 64M ثم أعد تشغيل MySQL. حدّث السجلات قبل إعادة الحفظ للتحقق من نتيجة العملية.','code'=>'DB_CONNECTION_LOST'],503);
    $message=$code===1146?'جداول قاعدة البيانات غير مكتملة؛ شغّل التثبيت أو استورد ملف الجداول.':($code===1153?'الملف أكبر من حد MySQL المسموح لدى الاستضافة.':'تعذر إتمام العملية. راجع بيانات MySQL وسجل أخطاء PHP.');
    json_response(['error'=>$message],500);
}

<?php
declare(strict_types=1);

function bank_transfer_download(PDO $db, string $owner, string $id): never
{
    $row = one($db, 'SELECT source_name,source_mime,source_file FROM bank_transfers WHERE owner=? AND id=?', [$owner,$id]);
    if (!$row) json_response(['error'=>'الحوالة غير موجودة.'],404);
    header('Content-Type: '.$row['source_mime']);
    header("Content-Disposition: attachment; filename*=UTF-8''".rawurlencode($row['source_name']));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    header('Content-Length: '.strlen($row['source_file']));
    echo $row['source_file'];
    exit;
}

function bank_transfer_save(PDO $db, string $owner): never
{
    need_action('create');
    $input = json_decode((string)($_POST['data'] ?? ''), true);
    if (!is_array($input)) json_response(['error'=>'بيانات الحوالة غير صالحة.'],400);
    $officeId = is_string($input['office_id'] ?? null) ? $input['office_id'] : '';
    $createOffice = $officeId === '__new__';
    if ($createOffice) need_action('manage');
    else {
        $office = office_get($db,$owner,$officeId);
        if (!$office || !(int)$office['active']) json_response(['error'=>'اختر مكتبًا نشطًا من مساحة عملك.'],400);
    }
    $data = [];
    foreach (['reference'=>80,'beneficiary'=>200,'bank'=>200,'beneficiary_account'=>64] as $field=>$limit) {
        $value = trim(is_string($input[$field] ?? null) ? $input[$field] : '');
        if ($value === '' || cut_text($value,$limit) !== $value) json_response(['error'=>'راجع الرقم المرجعي وبيانات المستفيد والبنك.'],400);
        $data[$field] = $value;
    }
    $data['reference'] = strtoupper($data['reference']);
    foreach (['transfer_date','value_date'] as $field) {
        $value = $input[$field] ?? '';
        if ($field === 'value_date' && $value === '') { $data[$field] = null; continue; }
        if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$value,$parts)
            || !checkdate((int)$parts[2],(int)$parts[3],(int)$parts[1])) json_response(['error'=>'راجع تواريخ الحوالة.'],400);
        $data[$field] = $value;
    }
    $currency = strtoupper(is_string($input['currency'] ?? null) ? $input['currency'] : '');
    if (!preg_match('/^[A-Z]{3}$/D',$currency)) json_response(['error'=>'أدخل رمز العملة من ثلاثة أحرف.'],400);
    foreach (['amount','debit_sar','charges'] as $field) {
        $value = $input[$field] ?? '';
        if ($field !== 'amount' && $value === '') { $data[$field] = null; continue; }
        if (!is_string($value) || !preg_match('/^\d{1,13}(?:\.\d{1,2})?$/D',$value) || ($field === 'amount' && (float)$value <= 0)) {
            json_response(['error'=>'راجع المبالغ واستخدم منزلتين عشريتين على الأكثر.'],400);
        }
        $data[$field] = $value;
    }
    $file = uploaded('file', 15*1024*1024);
    if (!$file) json_response(['error'=>'أرفق ملف الحوالة الأصلي.'],400);
    $bytes = file_get_contents($file['tmp_name']);
    if ($bytes === false) json_response(['error'=>'تعذرت قراءة الملف المرفوع.'],400);
    $mime = str_starts_with($bytes,'%PDF-') ? 'application/pdf' : (@getimagesizefromstring($bytes)['mime'] ?? '');
    if (!in_array($mime,['application/pdf','image/jpeg','image/png','image/webp'],true)) json_response(['error'=>'الصيغ المدعومة PDF وJPG وPNG وWebP.'],400);
    check_binary_packet($db, strlen($bytes));
    if ($createOffice) {
        $officeName = trim(preg_replace('/\s+OF$/i','',$data['beneficiary']));
        if (!preg_match('/\p{L}/u',$officeName)) json_response(['error'=>'راجع اسم المستفيد.'],400);
        $officeCountry = office_valid_country(is_string($input['office_country'] ?? null) ? $input['office_country'] : '');
    }
    $id = uuid();
    $db->beginTransaction();
    try {
        if ($createOffice) {
            $key = static function (string $name): string {
                return preg_replace('/[^\p{L}\p{N}]/u','',mb_strtoupper(trim(preg_replace('/\s+OF$/i','',trim($name))),'UTF-8'));
            };
            $matches = array_values(array_filter(
                query($db,'SELECT id,name,country,active FROM recruitment_offices WHERE owner=? FOR UPDATE',[$owner])->fetchAll(),
                fn (array $row): bool => $key($row['name']) === $key($officeName),
            ));
            if (count($matches)>1 || ($matches && (!(int)$matches[0]['active'] || office_country($matches[0]['country']) !== $officeCountry))) {
                $db->rollBack();
                json_response(['error'=>'يوجد مكتب مشابه ببيانات مختلفة أو معطل. راجع قائمة المكاتب قبل الحفظ.'],409);
            }
            $office = $matches[0] ?? null;
            if (!$office) {
                $office = ['id'=>uuid()];
                query($db,'INSERT INTO recruitment_offices(id,owner,name,country,active,version,created,updated) VALUES(?,?,?,?,1,1,?,?)',
                    [$office['id'],$owner,$officeName,$officeCountry,now_iso(),now_iso()]);
                audit_event($db,$owner,'office-create-from-bank-transfer',$office['id'],$officeName);
            }
        }
        query($db,'INSERT INTO bank_transfers (id,owner,office_id,reference,transfer_date,value_date,beneficiary,bank,beneficiary_account,currency,amount,debit_sar,charges,source_name,source_mime,source_sha,source_file,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$id,$owner,$office['id'],$data['reference'],$data['transfer_date'],$data['value_date'],$data['beneficiary'],$data['bank'],
            $data['beneficiary_account'],$currency,$data['amount'],$data['debit_sar'],$data['charges'],cut_text(basename($file['name']),255),
            $mime,hash('sha256',$bytes),$bytes,now_iso()]);
        audit_event($db,$owner,'bank-transfer-created',$id,$data['reference']);
        $db->commit();
    } catch (PDOException $error) {
        safe_rollback($db);
        if ((int)($error->errorInfo[1] ?? 0) === 1062) json_response(['error'=>'الحوالة مسجلة من قبل بنفس المرجع أو الملف.'],409);
        throw $error;
    }
    json_response(['id'=>$id],201);
}

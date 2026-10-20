<?php
declare(strict_types=1);
const APP_ROOT = __DIR__ . '/..';
function base_path(): string {
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/index.php');
    if (str_ends_with($script, '/api/index.php')) return substr($script, 0, -14);
    $base = dirname($script);
    return $base === '/' || $base === '.' ? '' : rtrim($base, '/');
}
function url(string $path = ''): string { return base_path() . '/' . ltrim($path, '/'); }
function h(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function configuration(): ?array {
    static $loaded = false, $config;
    if (!$loaded) { $loaded = true; $config = is_file(__DIR__.'/config.php') ? require __DIR__.'/config.php' : null; }
    return $config;
}
function database(?array $settings = null): PDO {
    static $pdo;
    if ($settings === null && $pdo instanceof PDO) return $pdo;
    $c = $settings ?? configuration();
    if (!$c) throw new RuntimeException('SETUP');
    $options = [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_STRINGIFY_FETCHES=>false];
    $connection = new PDO('mysql:host='.$c['db_host'].';port='.($c['db_port']??3306).';dbname='.$c['db_name'].';charset=utf8mb4', $c['db_user'], $c['db_password'], $options);
    if ($settings === null) $pdo = $connection;
    return $connection;
}
function secure_request(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode','1'); ini_set('session.use_only_cookies','1');
    session_name('EJAZ_'.substr(hash('sha256', realpath(APP_ROOT) ?: APP_ROOT),0,12));
    session_set_cookie_params(['lifetime'=>0,'path'=>base_path().'/', 'secure'=>secure_request(),'httponly'=>true,'samesite'=>'Lax']);
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function csrf(): string { start_session(); return (string)$_SESSION['csrf']; }
function csrf_valid(?string $token): bool { return is_string($token) && hash_equals(csrf(), $token); }
function logged_in(): bool {
    start_session(); $c=configuration();
    return $c && !empty($_SESSION['authenticated']) && ($_SESSION['expires']??0)>time() && hash_equals((string)($c['auth_version']??''),(string)($_SESSION['auth_version']??''));
}
function json_response(array $data, int $status = 200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: private, no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE); exit;
}
function guard_api(bool $write = false): string {
    if (!configuration()) json_response(['error'=>'افتح صفحة التثبيت أولًا.','setup'=>true],503);
    if (!logged_in()) json_response(['error'=>'يلزم تسجيل الدخول'],401);
    if ($write && !csrf_valid($_SERVER['HTTP_X_CSRF_TOKEN']??null)) json_response(['error'=>'انتهت صلاحية الطلب؛ حدّث الصفحة وأعد المحاولة.'],403);
    $owner=(string)(configuration()['owner_id']??'ejaz-admin'); session_write_close(); return $owner;
}
function require_page(): void {
    if (!configuration()) { header('Location: '.url('install.php')); exit; }
    if (!logged_in()) { header('Location: '.url('login')); exit; }
}
function query(PDO $db,string $sql,array $args=[]): PDOStatement { $s=$db->prepare($sql);$s->execute($args);return $s; }
function one(PDO $db,string $sql,array $args=[]): ?array { $r=query($db,$sql,$args)->fetch(); return $r===false?null:$r; }
function uuid(): string { $b=random_bytes(16);$b[6]=chr((ord($b[6])&15)|64);$b[8]=chr((ord($b[8])&63)|128);$s=bin2hex($b);return substr($s,0,8).'-'.substr($s,8,4).'-'.substr($s,12,4).'-'.substr($s,16,4).'-'.substr($s,20); }
function now_iso(): string { return gmdate('Y-m-d\TH:i:s').'.000Z'; }
function passport(string $value): string {
    $value=strtr($value,['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9','۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9']);
    if(class_exists('Normalizer'))$value=Normalizer::normalize($value,Normalizer::FORM_KC)?:$value;
    return strtoupper(preg_replace('/[\s-]+/u','',$value)??'');
}
function cut_text(string $value,int $length): string { return function_exists('mb_substr') ? mb_substr(trim($value),0,$length,'UTF-8') : implode('',array_slice(preg_split('//u',trim($value),-1,PREG_SPLIT_NO_EMPTY)?:[],0,$length)); }
function transliterate(string $name): string {
    $config=json_decode(file_get_contents(__DIR__.'/names.json'),true);
    return preg_replace(['/اا+/u','/يي+/u','/وو+/u'],['ا','ي','و'],implode(' ',array_map(function($word)use($config){$w=strtolower(preg_replace("/[^a-z'-]/i",'',$word)??'');if(isset($config['names'][$w]))return $config['names'][$w];$out='';for($i=0;$i<strlen($w);){$found=false;foreach($config['parts']as$chunk=>$value)if(substr($w,$i,strlen($chunk))===$chunk){$out.=$value;$i+=strlen($chunk);$found=true;break;}if(!$found){$out.=$config['single'][$w[$i]]??'';$i++;}}return $out;},preg_split('/\s+/u',trim($name))?:[])))??'';
}
function clean_cv(array $data): array {
    $fields=['name','nameAr','passport','nationality','job','salary','currency','contract','birthDate','age','birthPlace','religion','marital','children','height','weight','education','phone','address','issueDate','expiryDate','issuePlace','english','arabic','experience','experienceCountry','skills','relative','relativePhone','notes'];
    $clean=[];foreach($fields as$key)$clean[$key]=cut_text(is_scalar($data[$key]??'')?(string)($data[$key]??''):'',$key==='notes'?12000:2000);
    $clean['_evidence']=cut_text(is_string($data['_evidence']??null)?$data['_evidence']:'',80000);
    $clean['_review']=cut_text(is_string($data['_review']??null)?$data['_review']:'',40000);
    $clean['extractedText']=cut_text(is_string($data['extractedText']??null)?$data['extractedText']:'',200000);
    $clean['passport']=passport($clean['passport']);
    if(!$clean['name']&&$clean['nameAr'])$clean['name']=$clean['nameAr'];
    if(!$clean['nameAr']&&$clean['name'])$clean['nameAr']=preg_match('/[\x{0600}-\x{06ff}]/u',$clean['name'])?$clean['name']:transliterate($clean['name']);
    return $clean;
}
function read_json(): array { $value=json_decode(file_get_contents('php://input'),true);if(!is_array($value))json_response(['error'=>'طلب JSON غير صالح'],400);return $value; }
function uploaded(string $field,int $limit): ?array {
    $f=$_FILES[$field]??null;if(!$f || ($f['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE)return null;
    if(($f['error']??-1)!==UPLOAD_ERR_OK)json_response(['error'=>'تعذر رفع الملف. راجع حد الرفع في إعدادات PHP.'],413);
    if(!is_uploaded_file($f['tmp_name'])||$f['size']<1||$f['size']>$limit)json_response(['error'=>'حجم الملف أكبر من الحد المسموح.'],413);
    return $f;
}
function photo_payload(?array $file): ?array {
    if(!$file)return null;$bytes=file_get_contents($file['tmp_name']);$info=@getimagesizefromstring($bytes);
    if(!$info||!in_array($info['mime'],['image/jpeg','image/png'],true))json_response(['error'=>'اختر صورة JPG أو PNG صحيحة.'],400);
    return ['id'=>uuid(),'mime'=>$info['mime'],'data'=>$bytes];
}
function store_photo(PDO $db,string $owner,array $picture,string $now): string {
    query($db,'INSERT INTO photos(id,owner,mime,data,created) VALUES(?,?,?,?,?)',[$picture['id'],$owner,$picture['mime'],$picture['data'],$now]);return 'db:'.$picture['id'];
}
function history_row(PDO $db,array $old,string $now): void {query($db,'INSERT INTO history(id,owner,record_id,data,source,photo,created) VALUES(?,?,?,?,?,?,?)',[uuid(),$old['owner'],$old['id'],$old['data'],$old['source'],$old['photo'],$now]);}

function safe_rollback(PDO $db): void {
    try { if($db->inTransaction())$db->rollBack(); }
    catch(Throwable $rollbackError) { error_log('Ejaz PHP: rollback unavailable after database failure.'); }
}
function check_binary_packet(PDO $db,int $size): void {
    $limit=(int)(one($db,'SELECT @@SESSION.max_allowed_packet AS packet_limit')['packet_limit']??0);
    if($limit>0 && $size+65536>$limit) {
        $mb=round($limit/1048576,2);
        json_response(['error'=>'الملف أو الصورة أكبر من حد MySQL الحالي ('.$mb.' MB). في XAMPP افتح MySQL > Config > my.ini واضبط max_allowed_packet=64M داخل [mysqld] ثم أعد تشغيل MySQL.','code'=>'DB_PACKET_LIMIT','limitBytes'=>$limit],413);
    }
}

require_once __DIR__.'/workspace.php';

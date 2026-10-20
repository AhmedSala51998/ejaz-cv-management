<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';
if(configuration()){http_response_code(404);exit('تم التثبيت بالفعل. افتح صفحة تسجيل الدخول.');}
start_session();$error='';$defaults=['db_host'=>'localhost','db_port'=>'3306','db_name'=>'','db_user'=>'','admin_username'=>'admin'];
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST') {
    foreach($defaults as$key=>$value)$defaults[$key]=trim((string)($_POST[$key]??$value));
    try {
        if(!csrf_valid($_POST['csrf']??null))throw new RuntimeException('انتهت صلاحية الطلب؛ حدّث الصفحة.');
        if(version_compare(PHP_VERSION,'8.2','<')||!extension_loaded('pdo_mysql'))throw new RuntimeException('فعّل PHP 8.3 أو أحدث وإضافة pdo_mysql في لوحة الاستضافة.');
        if(!$defaults['db_name']||!$defaults['db_user']||!$defaults['admin_username'])throw new RuntimeException('أكمل الحقول المطلوبة.');
        $password=(string)($_POST['admin_password']??'');
        if(strlen($password)<12||$password!==(string)($_POST['admin_password_confirm']??''))throw new RuntimeException('كلمة مرور المدير يجب أن تكون 12 حرفًا على الأقل ومطابقة للتأكيد.');
        $host=$defaults['db_host'];$port=(int)$defaults['db_port'];
        if(!$host||str_contains($host,';')||$port<1||$port>65535||str_contains($defaults['db_name'],';'))throw new RuntimeException('راجع المضيف والمنفذ واسم القاعدة.');
        $lock=fopen(__DIR__.'/private/install.lock','c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('تعذر كتابة إعدادات التثبيت. راجع صلاحيات مجلد private.');
        if(is_file(__DIR__.'/private/config.php'))throw new RuntimeException('تم التثبيت بالفعل.');
        $config=['db_host'=>$host,'db_port'=>$port,'db_name'=>$defaults['db_name'],'db_user'=>$defaults['db_user'],'db_password'=>(string)($_POST['db_password']??''),'admin_username'=>cut_text($defaults['admin_username'],128),'admin_password_hash'=>password_hash($password,PASSWORD_DEFAULT),'owner_id'=>'ejaz-admin','auth_version'=>bin2hex(random_bytes(32))];
        $db=database($config);$sql=(file_get_contents(__DIR__.'/private/mysql-schema.sql')."\n".file_get_contents(__DIR__.'/private/workspace-schema.sql'));
        foreach(preg_split('/;\s*(?:\r?\n|$)/',$sql)as$statement)if(trim($statement)!=='')$db->exec($statement);
        $temp=tempnam(__DIR__.'/private','cfg_');if(!$temp||file_put_contents($temp,"<?php\nreturn ".var_export($config,true).";\n")===false)throw new RuntimeException('تعذر حفظ config.php.');
        chmod($temp,0600);if(!rename($temp,__DIR__.'/private/config.php')){unlink($temp);throw new RuntimeException('تعذر اعتماد الإعدادات.');}
        flock($lock,LOCK_UN);fclose($lock);session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));header('Location: '.url('login').'?installed=1');exit;
    }catch(Throwable $e){
        $error=$e instanceof PDOException?'تعذر تجهيز MySQL. راجع اسم القاعدة والمستخدم وكلمة المرور وصلاحيات المستخدم.':$e->getMessage();
        if(isset($lock)&&is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}
    }
}
$manifest=json_decode(file_get_contents(__DIR__.'/assets/.vite/manifest.json'),true);$css=$manifest['main.tsx']['css'][0];
?>
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>تثبيت إيجاز</title><link rel="stylesheet" href="<?=h(url('assets/'.$css))?>"><style>.setup{max-width:760px;margin:35px auto;background:#fff;border:1px solid #e2e5dc;border-radius:18px;padding:35px}.setup h1{font-size:28px}.setup p{margin:15px 0;color:#777}.setup .field-grid{margin:20px 0}.setup input{width:100%}.setup h2{margin-top:25px}.setup .notice{margin:20px 0}</style></head><body><main class="setup"><img src="<?=h(url('logo.png'))?>" width="140" alt="إيجاز"><h1>تجهيز مركز السير الذاتية</h1><p>أدخل بيانات قاعدة MySQL التي أنشأتها في Hostinger، ثم اختر حساب المدير. تُنشأ الجداول تلقائيًا دون حذف بياناتها الموجودة.</p><?php if($error):?><div role="alert" class="notice"><?=h($error)?></div><?php endif;?>
<form method="post"><input type="hidden" name="csrf" value="<?=h(csrf())?>"><h2>قاعدة البيانات</h2><div class="field-grid">
<?php foreach(['db_host'=>'مضيف MySQL','db_port'=>'المنفذ','db_name'=>'اسم القاعدة الكامل','db_user'=>'اسم المستخدم الكامل']as$key=>$label):?><label><?=$label?><input name="<?=$key?>" value="<?=h($defaults[$key])?>" required dir="ltr"></label><?php endforeach;?>
<label class="wide">كلمة مرور قاعدة البيانات<input name="db_password" type="password" autocomplete="new-password" dir="ltr"></label></div><h2>حساب المدير</h2><div class="field-grid"><label class="wide">اسم المستخدم<input name="admin_username" value="<?=h($defaults['admin_username'])?>" required maxlength="128" autocomplete="username" dir="ltr"></label><label>كلمة مرور جديدة<input name="admin_password" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></label><label>تأكيد كلمة المرور<input name="admin_password_confirm" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></label></div><button class="primary" type="submit">إنشاء الجداول وإكمال التثبيت</button></form><p>بعد النجاح تُغلق هذه الصفحة تلقائيًا، وتدخل إلى الموقع بحساب المدير الذي اخترته. لا تحتاج Node.js أو أوامر npm.</p></main></body></html>

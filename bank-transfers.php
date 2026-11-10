<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';
require_page();
need_action('view');
require __DIR__.'/private/offices.php';
$db = database();
workspace_schema($db);
$owner = (string)(configuration()['owner_id'] ?? 'ejaz-admin');
$id = is_string($_GET['id'] ?? null) ? $_GET['id'] : '';
$fields = [
    'reference'=>'مرجع التحويل', 'transfer_date'=>'تاريخ العملية', 'value_date'=>'تاريخ القيمة',
    'beneficiary'=>'اسم المستفيد', 'bank'=>'بنك المستفيد', 'beneficiary_account'=>'حساب المستفيد',
    'currency'=>'عملة الحوالة', 'amount'=>'المبلغ المحوّل', 'debit_sar'=>'الخصم بالريال', 'charges'=>'رسوم البنك',
];
$select = 'SELECT t.id,t.reference,t.transfer_date,t.value_date,t.beneficiary,t.bank,t.beneficiary_account,t.currency,t.amount,t.debit_sar,t.charges,t.source_name,o.name AS office_name FROM bank_transfers t LEFT JOIN recruitment_offices o ON o.id=t.office_id AND o.owner=t.owner WHERE t.owner=?';
$record = $id !== '' ? one($db,$select.' AND t.id=?',[$owner,$id]) : null;
if ($id !== '' && !$record) http_response_code(404);
$officeFilter = is_string($_GET['office'] ?? null) ? $_GET['office'] : '';
$offices = $id === '' ? query($db,'SELECT id,name,active FROM recruitment_offices WHERE owner=? ORDER BY name',[$owner])->fetchAll() : [];
$page = max(1,min(10000,(int)($_GET['page'] ?? 1)));
$offset = ($page - 1)*25;
$rows = $id === '' ? query($db,$select.($officeFilter !== '' ? ' AND t.office_id=?' : '')." ORDER BY t.transfer_date DESC,t.id DESC LIMIT 26 OFFSET $offset",
    $officeFilter !== '' ? [$owner,$officeFilter] : [$owner])->fetchAll() : [];
$manifest = json_decode(file_get_contents(__DIR__.'/assets/manifest.json'), true);
$links = [
    ['','رفع واستيراد','M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4'],
    ['records','السير الذاتية','M8 3h9l4 4v11H8zM3 7v14h14'],
    ['tickets','تذاكر السفر','m3 11 7 2 2 7 2-1 1-5 5-5c2-2 1-4-1-3l-6 5-8-2z'],
    ['bank-transfers.php','الحوالات البنكية','M3 10h18L12 3 3 10zm2 4v4m5-4v4m4-4v4m5-4v4M3 22h18'],
    ['offices','مكاتب الاستقدام','M4 21V5h10v16m0-12h6v12M2 21h20M8 9h2m-2 4h2m-2 4h2'],
];
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="csrf-token" content="<?=h(csrf())?>"><title>إيجاز | حوالات المكاتب الخارجية</title>
<?php foreach ($manifest['main.tsx']['css'] ?? [] as $css): ?><link rel="stylesheet" href="<?=h(url('assets/'.$css))?>"><?php endforeach; ?>
<link rel="stylesheet" href="<?=h(url('assets/bank-transfers.css?v=3'))?>"></head>
<body class="bank-transfer-page">
<header class="header">
    <a class="brand" href="<?=h(url())?>"><img src="<?=h(url('logo.png'))?>" alt="شركة إيجاز للاستقدام"><span class="brand-divider"></span><span>مركز السير الذاتية<small>إدارة ملفات العمالة</small></span></a>
    <nav aria-label="روابط الموقع">
    <?php foreach ($links as [$path,$title,$icon]): ?>
        <a href="<?=h(url($path))?>" <?=$path==='bank-transfers.php'?'class="active" aria-current="page"':''?>><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="<?=h($icon)?>"></path></svg><?=$title?></a>
    <?php endforeach; ?>
    </nav>
    <div class="private"><span>مساحة عمل خاصة</span><button type="button" class="text-button" id="transfer-logout" data-url="<?=h(url('api/index.php?resource=auth/logout'))?>" data-login="<?=h(url('login'))?>">خروج</button></div>
</header>
<div class="breadcrumb">إيجاز للاستقدام <span>/</span> مركز السير الذاتية <span>/</span> <strong>الحوالات البنكية</strong></div>
<main id="transfers" data-page="<?=h(url('bank-transfers.php'))?>" data-api="<?=h(url('api/index.php?resource=bank-transfers'))?>"
 data-base="<?=h(base_path())?>" data-pdf="<?=h(url('assets/bank-transfer-pdf.mjs'))?>"
 data-ocr="<?=h(url('assets/bank-transfer-ocr.mjs'))?>">
<div class="transfer-heading"><div><span class="eyebrow">إيجاز · مكاتب الاستقدام</span><h1><?= $record ? 'نموذج حوالة بنكية' : 'حوالات المكاتب الخارجية' ?></h1></div>
<?php if ($record): ?><a class="secondary" href="<?=h(url('bank-transfers.php'))?>">العودة إلى سجل الحوالات</a><?php endif; ?></div>
<?php if ($record): ?>
<section class="paper"><h2><?=h($record['office_name'] ?? 'مكتب غير متاح')?></h2><dl class="grid">
<?php foreach ($fields as $key=>$label): ?><div><dt><?=h($label)?></dt><dd><bdi><?=h((string)($record[$key] ?? '—'))?></bdi></dd></div><?php endforeach; ?>
</dl><p>المرفق الأصلي · <bdi><?=h($record['source_name'])?></bdi></p>
<div class="actions"><button type="button" id="print-transfer">طباعة / حفظ PDF</button>
<a class="button" href="<?=h(url('api/index.php?resource=bank-transfers/download&id='.rawurlencode($id)))?>">تحميل الملف الأصلي</a></div></section>
<?php elseif ($id !== ''): ?><section class="paper">الحوالة غير موجودة.</section>
<?php else: ?>
<?php if (allow_action('create')): ?>
<section class="paper"><h2>إضافة حوالة بنكية</h2>
<p>ارفع صور الحوالات أو ملفات PDF، وراجع كل نموذج واختر المكتب قبل الحفظ. تُقرأ الملفات في المتصفح.</p>
<form id="transfer-form">
<label>الملفات الأصلية<input id="transfer-files" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple required></label>
<p id="transfer-status" role="status" aria-live="polite"></p>
<div class="grid">
<label>المكتب الخارجي<select name="office_id" required><option value="">اختر المكتب</option>
<?php foreach ($offices as $office): if (!(int)$office['active']) continue; ?><option value="<?=h($office['id'])?>"><?=h($office['name'])?></option><?php endforeach; ?>
<?php if (allow_action('manage')): ?><option value="__new__">إضافة المستفيد كمكتب جديد</option><?php endif; ?>
</select></label>
<label id="new-office-country" hidden>بلد المكتب الجديد<select name="office_country"><option value="">اختر البلد</option>
<?php foreach (['ETHIOPIAN'=>'إثيوبيا','UGANDAN'=>'أوغندا','FILIPINO'=>'الفلبين','SRI LANKAN'=>'سريلانكا','INDIAN'=>'الهند','BURUNDIAN'=>'بوروندي','KENYAN'=>'كينيا','BANGLADESHI'=>'بنجلاديش','SOMALI'=>'الصومال'] as $code=>$label): ?>
<option value="<?=h($code)?>"><?=h($label)?></option>
<?php endforeach; ?></select></label>
<?php foreach ($fields as $key=>$label):
$type = str_ends_with($key,'_date') ? 'date' : 'text';
$optional = in_array($key,['value_date','debit_sar','charges'],true); ?>
<label><?=h($label)?><input name="<?=h($key)?>" type="<?=$type?>" <?=$optional ? '' : 'required'?> <?=in_array($key,['amount','debit_sar','charges'],true) ? 'inputmode="decimal" dir="ltr"' : ''?>></label>
<?php endforeach; ?></div>
<details><summary>النص المقروء للمراجعة</summary><pre id="transfer-text"></pre></details>
<div class="actions"><button type="submit" id="save-transfer">حفظ الحوالة</button><button type="button" id="skip-transfer" hidden>تخطي إلى الملف التالي</button></div>
</form></section>
<?php endif; ?>
<section class="paper"><h2>سجل الحوالات</h2>
<form class="actions" method="get"><label>المكتب<select name="office"><option value="">كل المكاتب</option>
<?php foreach ($offices as $office): ?><option value="<?=h($office['id'])?>" <?=$officeFilter===$office['id']?'selected':''?>><?=h($office['name'])?></option><?php endforeach; ?>
</select></label><button type="submit">عرض</button></form>
<div class="scroll"><table><thead><tr><th>المرجع</th><th>التاريخ</th><th>المكتب</th><th>المبلغ</th><th>النموذج</th></tr></thead><tbody>
<?php foreach (array_slice($rows,0,25) as $row): ?><tr><td><bdi><?=h($row['reference'])?></bdi></td><td><?=h($row['transfer_date'])?></td><td><?=h($row['office_name'] ?? '—')?></td><td><bdi><?=h($row['amount'].' '.$row['currency'])?></bdi></td><td><a href="?id=<?=rawurlencode($row['id'])?>">عرض الحوالة</a></td></tr><?php endforeach; ?>
<?php if (!$rows): ?><tr><td colspan="5">لا توجد حوالات في هذا العرض.</td></tr><?php endif; ?></tbody></table></div>
<nav><?php if ($page>1): ?><a href="?office=<?=rawurlencode($officeFilter)?>&amp;page=<?=$page-1?>">السابق</a><?php endif; ?>
<?php if (count($rows)>25): ?><a href="?office=<?=rawurlencode($officeFilter)?>&amp;page=<?=$page+1?>">التالي</a><?php endif; ?></nav>
</section>
<?php endif; ?>
</main><script type="module" src="<?=h(url('assets/bank-transfers.mjs?v=3'))?>"></script></body></html>

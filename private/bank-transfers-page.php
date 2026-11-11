<?php
declare(strict_types=1);
need_action('view');
$db = database();
$owner = (string)(configuration()['owner_id'] ?? 'ejaz-admin');
$id = is_string($_GET['id'] ?? null) ? $_GET['id'] : '';
$fields = [
    'reference'=>'مرجع التحويل', 'transfer_date'=>'تاريخ العملية', 'value_date'=>'تاريخ القيمة',
    'beneficiary'=>'اسم المستفيد', 'bank'=>'بنك المستفيد', 'beneficiary_account'=>'حساب المستفيد',
    'currency'=>'عملة الحوالة', 'amount'=>'المبلغ المحوّل', 'debit_sar'=>'الخصم بالريال', 'charges'=>'رسوم البنك',
];
try {
    $select = 'SELECT t.id,t.reference,t.transfer_date,t.value_date,t.beneficiary,t.bank,t.beneficiary_account,t.currency,t.amount,t.debit_sar,t.charges,t.source_name,o.name AS office_name FROM bank_transfers t LEFT JOIN recruitment_offices o ON o.id=t.office_id AND o.owner=t.owner WHERE t.owner=?';
    $record = $id !== '' ? one($db,$select.' AND t.id=?',[$owner,$id]) : null;
    if ($id !== '' && !$record) http_response_code(404);
    $officeFilter = is_string($_GET['office'] ?? null) ? $_GET['office'] : '';
    $offices = $id === '' ? query($db,'SELECT id,name,active FROM recruitment_offices WHERE owner=? ORDER BY name',[$owner])->fetchAll() : [];
    $page = max(1,min(10000,(int)($_GET['page'] ?? 1)));
    $offset = ($page - 1)*25;
    $rows = $id === '' ? query($db,$select.($officeFilter !== '' ? ' AND t.office_id=?' : '')." ORDER BY t.transfer_date DESC,t.id DESC LIMIT 26 OFFSET $offset",
        $officeFilter !== '' ? [$owner,$officeFilter] : [$owner])->fetchAll() : [];
} catch (PDOException $exception) {
    if ((int) ($exception->errorInfo[1] ?? 0) !== 1146) throw $exception;
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: private, no-store');
    exit('جدول الحوالات غير موجود في قاعدة بيانات الموقع. استورد database/bank-transfers-upgrade.sql يدويًا ثم أعد فتح الصفحة.');
}
$manifestPath = APP_ROOT.'/assets/manifest.json';
if (!is_file($manifestPath)) $manifestPath = APP_ROOT.'/assets/.vite/manifest.json';
$manifestJson = is_readable($manifestPath) ? @file_get_contents($manifestPath) : false;
$manifest = is_string($manifestJson) ? json_decode($manifestJson, true) : [];
$links = [
    ['','رفع واستيراد',['M12 13v8', 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'm8 17 4-4 4 4']],
    ['records','السير الذاتية',['M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8', 'M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z', 'M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1']],
    ['tickets','تذاكر السفر',['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z']],
    ['bank-transfers','الحوالات البنكية',['M3 10h18L12 3 3 10zm2 4v4m5-4v4m4-4v4m5-4v4M3 22h18']],
    ['offices','مكاتب الاستقدام',['M10 12h4', 'M10 8h4', 'M14 21v-3a2 2 0 0 0-4 0v3', 'M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2', 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16']],
];
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="csrf-token" content="<?=h(csrf())?>"><title>إيجاز | حوالات المكاتب الخارجية</title>
<?php foreach ($manifest['main.tsx']['css'] ?? [] as $css): ?><link rel="stylesheet" href="<?=h(url('assets/'.$css))?>"><?php endforeach; ?>
<link rel="stylesheet" href="<?=h(url('assets/bank-transfers.css?v=5'))?>"></head>
<body class="bank-transfer-page<?= $record ? ' transfer-detail-page' : '' ?>">
<header class="header">
    <a class="brand" href="<?=h(url())?>"><img src="<?=h(url('logo.png'))?>" alt="شركة إيجاز للاستقدام"><span class="brand-divider"></span><span>مركز السير الذاتية<small>إدارة ملفات العمالة</small></span></a>
    <nav aria-label="روابط الموقع">
    <?php foreach ($links as [$path,$title,$icon]): ?>
        <a href="<?=h(url($path))?>" <?=$path==='bank-transfers'?'class="active" aria-current="page"':''?>><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><?php foreach ($icon as $iconPath): ?><path d="<?=h($iconPath)?>"></path><?php endforeach; ?></svg><?=$title?></a>
    <?php endforeach; ?>
    </nav>
    <div class="private"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg><span>مساحة عمل خاصة</span><button type="button" class="text-button" id="transfer-logout" data-url="<?=h(url('api/auth/logout'))?>" data-login="<?=h(url('login'))?>">خروج</button></div>
</header>
<div class="breadcrumb">إيجاز للاستقدام <span>/</span> مركز السير الذاتية <span>/</span> <strong>الحوالات البنكية</strong></div>
<main id="transfers" data-page="<?=h(url('bank-transfers'))?>" data-api="<?=h(url('api/bank-transfers'))?>"
 data-base="<?=h(base_path())?>" data-pdf="<?=h(url('assets/bank-transfer-pdf.mjs'))?>"
 data-ocr="<?=h(url('assets/bank-transfer-ocr.mjs'))?>">
<div class="transfer-heading"><div><span class="eyebrow">إيجاز · مكاتب الاستقدام</span><h1><?= $record ? 'نموذج حوالة بنكية' : 'حوالات المكاتب الخارجية' ?></h1></div>
<?php if ($record): ?><a class="secondary" href="<?=h(url('bank-transfers'))?>">العودة إلى سجل الحوالات</a><?php endif; ?></div>
<?php if ($record): ?>
<?php
$sourceUrl = url('api/bank-transfers/download?id='.rawurlencode($id));
$groups = [
    'بيانات التحويل' => ['reference','transfer_date','value_date'],
    'بيانات المستفيد' => ['beneficiary','bank','beneficiary_account'],
    'ملخص المبالغ' => ['debit_sar','charges'],
];
?>
<section class="paper transfer-receipt" data-reference="<?=h($record['reference'])?>" data-source-name="<?=h($record['source_name'])?>">
    <div class="receipt-brands">
        <img src="<?=h(url('logo.png'))?>" alt="شركة إيجاز للاستقدام">
        <img id="receipt-bank-logo" alt="شعار البنك المُرسل من مرفق الحوالة" hidden>
    </div>
    <div class="receipt-banner">
        <div><small lang="en" dir="ltr">INTERNATIONAL BANK TRANSFER</small><h2>تفاصيل الحوالة الدولية</h2></div>
        <div><small>المبلغ المحوّل</small><strong><bdi><?=h($record['amount'].' '.$record['currency'])?></bdi></strong></div>
    </div>
    <?php foreach ($groups as $heading => $keys): ?>
    <section class="receipt-group">
        <h3><?=h($heading)?></h3>
        <dl>
        <?php foreach ($keys as $key): ?>
            <div><dt><?=h($fields[$key])?></dt><dd><bdi><?=h((string)($record[$key] ?? '—'))?></bdi></dd></div>
        <?php endforeach; ?>
        <?php if ($keys[0] === 'beneficiary'): ?>
            <div><dt>المكتب الخارجي</dt><dd><bdi><?=h($record['office_name'] ?? '—')?></bdi></dd></div>
        <?php endif; ?>
        </dl>
    </section>
    <?php endforeach; ?>
    <footer class="receipt-footer">نسخة عرض من سجل الحوالات لدى إيجاز</footer>
</section>
<div class="actions receipt-controls">
    <button type="button" id="print-transfer">طباعة / حفظ PDF</button>
    <button type="button" id="select-bank-logo">تحديد شعار البنك من المرفق</button>
    <a class="button" id="receipt-original" href="<?=h($sourceUrl)?>">تحميل الملف الأصلي</a>
</div>
<p id="receipt-logo-status" class="receipt-controls transfer-notice" role="status" hidden></p>
<dialog id="receipt-logo-picker">
    <form method="dialog"><button>إغلاق</button></form>
    <p>اسحب إطارًا حول شعار البنك فقط، ثم اختر اعتماد الشعار.</p>
    <div id="receipt-logo-preview"><canvas aria-label="الصفحة الأولى من الحوالة"></canvas><div hidden></div></div>
    <button type="button" id="apply-bank-logo" disabled>اعتماد الشعار</button>
</dialog>
<?php elseif ($id !== ''): ?><section class="paper">الحوالة غير موجودة.</section>
<?php else: ?>
<?php if (allow_action('create')): ?>
<section class="paper"><h2>إضافة حوالة بنكية</h2>
<p>ارفع صور الحوالات أو ملفات PDF، وراجع كل نموذج واختر المكتب قبل الحفظ. تُقرأ الملفات في المتصفح.</p>
<form id="transfer-form">
<div class="transfer-drop" id="transfer-drop">
<input id="transfer-files" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple hidden>
<button type="button" id="choose-transfer-files">
<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"></path></svg>
<strong>اسحب ملفات الحوالات هنا أو اضغط للاختيار</strong><small>PDF · JPG · PNG · WebP — حتى 15 ميجابايت لكل ملف</small>
</button>
</div>
<div id="transfer-queue" class="transfer-queue" aria-label="ملفات الحوالات" hidden></div>
<p id="transfer-status" class="notice transfer-notice" role="status" aria-live="polite" hidden></p>
<details id="transfer-original" class="transfer-original" hidden><summary>معاينة الملف الأصلي</summary><div id="transfer-preview"></div></details>
<fieldset id="transfer-review" hidden>
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
<div class="actions"><button type="submit" id="save-transfer">حفظ الحوالة</button></div>
</fieldset></form></section>
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
</main><script type="module" src="<?=h(url('assets/bank-transfers.mjs?v=5'))?>"></script></body></html>

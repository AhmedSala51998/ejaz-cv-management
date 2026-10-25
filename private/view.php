<?php
declare(strict_types=1);
function render_application(string $view): void {
    $manifestPath=is_file(APP_ROOT.'/assets/manifest.json')?APP_ROOT.'/assets/manifest.json':APP_ROOT.'/assets/.vite/manifest.json';
    $manifest=json_decode(file_get_contents($manifestPath),true);
    $entry=$manifest['main.tsx'];$base=base_path();$token=csrf();
    header('Content-Type: text/html; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
    ?>
<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="csrf-token" content="<?=h($token)?>"><title>إيجاز | مركز السير الذاتية</title>
<style>.startup-loader{position:fixed;inset:0;z-index:9999;background:#fafbf7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#334a39;text-align:center}.loader-brand{font-size:48px;font-weight:800}.loader-brand span{display:block;font-size:14px}.loader-orbit{width:54px;height:54px;border:3px solid #e2e8da;border-top-color:#ed8a21;border-radius:50%;animation:boot-spin 1s linear infinite}@keyframes boot-spin{to{transform:rotate(360deg)}}body .processing-banner{position:fixed;inset:auto 20px 20px;z-index:1000;margin:0;justify-content:center;background:#fffaf3;border-color:#f5c88d;box-shadow:0 8px 35px #0002;pointer-events:none}
body .photo-frame>img,body .worker-photo{object-fit:contain;object-position:center;background:#fff}body .photo-candidates img{object-fit:contain;background:#fff}

.review-card>.notice{margin:20px 24px;width:auto;line-height:1.9}.review-card>.review-toolbar+.notice{margin-top:20px;margin-bottom:20px}@media(max-width:600px){.review-card>.notice{margin:16px 12px}}

.source-text-review{margin:16px 0;padding:12px 16px;border:1px solid #e1e6da;border-radius:8px;font-size:12px}.source-text-review summary{cursor:pointer;color:#8a642d}.source-text-review pre{white-space:pre-wrap;max-height:320px;overflow:auto;font:inherit;margin-top:12px}@media print{.source-text-review{display:none}}

.field-grid .field-needs-review input,.field-grid .field-needs-review select,.field-grid .field-needs-review textarea{border:2px solid #c77713;background:#fffcf3}.field-review-alert{display:flex;flex-direction:column;gap:6px;background:#fff6df;color:#754309;border:1px solid #edc781;border-radius:9px;padding:10px;font-size:12px;font-weight:400;line-height:1.8;overflow-wrap:anywhere}.field-review-alert b{font-weight:700}.field-review-alert .text-button{align-self:flex-start;white-space:normal;text-align:start;min-height:32px}.field-reviewed{color:#137343;font-size:12px}@media print{.field-review-alert,.field-reviewed{display:none}}
</style>
<?php foreach($entry['css']??[]as$css):?><link rel="stylesheet" href="<?=h(url('assets/'.$css))?>"><?php endforeach;?>
<script>window.__EJAZ_BASE__=<?=json_encode($base,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>;window.__EJAZ_VIEW__=<?=json_encode($view)?>;</script>
</head><body><div id="boot-screen" class="startup-loader" role="status"><div class="loader-brand">إيجاز<span>مركز السير الذاتية</span></div><div class="loader-orbit"></div><strong>بنجهّز مساحة عملك</strong><p>جارٍ تحميل الموقع والأدوات…</p><div class="loader-track"><i></i></div><noscript>يرجى تفعيل JavaScript لاستخدام أدوات استخراج السير.</noscript></div><div id="root"></div><script type="module" src="<?=h(url('assets/'.$entry['file']))?>"></script></body></html>
<?php }

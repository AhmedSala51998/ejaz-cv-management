<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';require_page();
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);
if (($_GET['view'] ?? '') === 'bank-transfers' || preg_match('~/bank-transfers/?$~', $path)) {
    $pageFile = __DIR__.'/private/bank-transfers-page.php';
    ob_start();
    try {
        if (!is_file($pageFile) || !is_readable($pageFile)) {
            throw new RuntimeException('BANK-01');
        }
        require $pageFile;
        ob_end_flush();
    } catch (Throwable $error) {
        ob_end_clean();
        $code = 'BANK-04';
        if ($error instanceof PDOException) {
            $driverCode = (int) ($error->errorInfo[1] ?? 0);
            $code = match ($driverCode) {
                1054 => 'BANK-02',
                1044, 1045, 1142 => 'BANK-03',
                default => 'BANK-DB',
            };
        } elseif ($error instanceof ParseError) {
            $code = 'BANK-05';
        } elseif ($error->getMessage() === 'BANK-01') {
            $code = 'BANK-01';
        }
        error_log(sprintf('Ejaz bank-transfers %s %s %s:%d', $code, get_class($error), basename($error->getFile()), $error->getLine()));
        http_response_code(503);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: private, no-store');
        echo '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>حوالات إيجاز</title><h1>تعذر فتح صفحة الحوالات</h1><p>رمز التشخيص: '.h($code).'</p></html>';
    }
    exit;
}
$view=(($_GET['view']??'')==='records'||preg_match('~/records/?$~',$path))?'records':'upload';
if(($_GET['view']??'')==='tickets'||preg_match('~/tickets/?$~',$path))$view='tickets';
if(($_GET['view']??'')==='offices'||preg_match('~/offices/?$~',$path))$view='offices';
require __DIR__.'/private/view.php';render_application($view);

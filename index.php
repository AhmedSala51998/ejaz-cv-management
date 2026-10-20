<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';require_page();
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);
$view=(($_GET['view']??'')==='records'||preg_match('~/records/?$~',$path))?'records':'upload';
require __DIR__.'/private/view.php';render_application($view);

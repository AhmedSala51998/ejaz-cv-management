<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';require_page();session_write_close();
$file=(string)($_GET['file']??'');if(!preg_match('/^[a-z0-9_-]+\.pdf$/i',$file)||!is_file(__DIR__.'/private/samples/'.$file)){http_response_code(404);exit('Not found');}
header('Content-Type: application/pdf');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Content-Length: '.filesize(__DIR__.'/private/samples/'.$file));readfile(__DIR__.'/private/samples/'.$file);

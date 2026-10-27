<?php
// Only needed for PHP's built-in local development server. Apache uses .htaccess.
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if(preg_match('~^/(private|frontend-source|tests)(/|$)|/\.~',$path)){http_response_code(404);exit;}
if($path==='/login') {$_SERVER['SCRIPT_NAME']='/login.php';require __DIR__.'/login.php';return true;}
if($path==='/offices'||$path==='/tickets'||$path==='/records'||$path==='/') {$_SERVER['SCRIPT_NAME']='/index.php';require __DIR__.'/index.php';return true;}
if(str_starts_with($path,'/api/')){$_GET['resource']=substr($path,5);$_SERVER['SCRIPT_NAME']='/api/index.php';require __DIR__.'/api/index.php';return true;}
if(preg_match('~^/samples/([^/]+)$~',$path,$m)){$_GET['file']=$m[1];$_SERVER['SCRIPT_NAME']='/samples.php';require __DIR__.'/samples.php';return true;}
$file=realpath(__DIR__.$path);if($file&&str_starts_with($file,__DIR__.'/')&&is_file($file))return false;
http_response_code(404);echo 'Not found';return true;

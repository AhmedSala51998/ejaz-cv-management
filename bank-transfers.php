<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';
$query = http_build_query(array_intersect_key($_GET, array_flip(['id', 'office', 'page'])));
header('Location: '.url('bank-transfers').($query === '' ? '' : '?'.$query), true, 302);
exit;

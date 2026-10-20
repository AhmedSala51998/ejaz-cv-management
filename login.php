<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';
if(!configuration()){header('Location: '.url('install.php'));exit;}
if(logged_in()){header('Location: '.url());exit;}
require __DIR__.'/private/view.php';render_application('login');

<?php
// The installer creates config.php with a real password hash. This example is not active.
return [
 'db_host'=>'localhost','db_port'=>3306,'db_name'=>'your_database','db_user'=>'your_user','db_password'=>'your_password',
 'admin_username'=>'admin','admin_password_hash'=>'GENERATE_WITH_PASSWORD_HASH',
 'owner_id'=>'ejaz-admin','auth_version'=>'GENERATE_64_RANDOM_HEX_CHARACTERS'
];

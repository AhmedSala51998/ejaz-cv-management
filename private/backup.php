<?php
declare(strict_types=1);
function export_backup(PDO $db,string $owner): void {
    $json=($_GET['format']??'sql')==='json';$schema=file_get_contents(__DIR__.'/mysql-schema.sql')."\n".file_get_contents(__DIR__.'/workspace-schema.sql');
    header('Cache-Control: private, no-store');header('Content-Type: '.($json?'application/json; charset=utf-8':'application/sql; charset=utf-8'));
    header('Content-Disposition: attachment; filename="ejaz-database.'.($json?'json':'sql').'"');
    $db->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,false);$db->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    if($json)echo '{"schema":'.json_encode($schema).',"exported":'.json_encode(now_iso()).',"tables":{';else echo $schema."\nSTART TRANSACTION;\n";
    $tables=['registry','records','history','photos','uploaded_files','record_meta','activity_events'];
    foreach($tables as$i=>$table){
        $select=in_array($table,['photos','uploaded_files'],true)?($table==='photos'?'SELECT id,owner,mime,HEX(data) AS data_hex,created FROM photos WHERE owner=?':'SELECT file_key,mime,HEX(data) AS data_hex,created FROM uploaded_files WHERE file_key LIKE ?'):'SELECT * FROM `'.$table.'` WHERE owner=?';
        $statement=query($db,$select,[$table==='uploaded_files'?$owner.'/%':$owner]);
        if($json)echo ($i?',':'').json_encode($table).':[';$first=true;
        while($row=$statement->fetch()){
            if($json){echo ($first?'':',').json_encode($row,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);$first=false;}
            else {
                $columns=[];$values=[];
                foreach($row as$key=>$value){$columns[]='`'.($key==='data_hex'?'data':$key).'`';$values[]=$value===null?'NULL':(is_int($value)||is_float($value)?(string)$value:($key==='data_hex'?"X'".$value."'":"CONVERT(X'".bin2hex((string)$value)."' USING utf8mb4)"));}
                echo 'INSERT INTO `'.$table.'` ('.implode(',',$columns).') VALUES ('.implode(',',$values).");\n";
            }
        }
        $statement->closeCursor();if($json)echo ']';
    }
    $db->commit();$db->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,true);echo $json?'}}':"COMMIT;\n";
}

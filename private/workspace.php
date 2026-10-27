<?php
declare(strict_types=1);
function workspace_schema(PDO $db): void
{
    static $done = false;
    if ($done) {
        return;
    }
    foreach (explode(";", (string) file_get_contents(__DIR__ . "/workspace-schema.sql")) as $sql) {
        if (trim($sql) !== "") {
            $db->exec($sql);
        }
    }
    if(!one($db,"SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='recruitment_offices' AND COLUMN_NAME='country'")){
        try{$db->exec("ALTER TABLE recruitment_offices ADD COLUMN country VARCHAR(100) NOT NULL DEFAULT ''");}
        catch(PDOException $e){if((int)($e->errorInfo[1]??0)!==1060)throw $e;}
    }
    $done = true;
}
function actor_info(): array
{
    $c = configuration();
    if (empty($_SESSION["staff_id"])) {
        return [
            "id" => "owner",
            "name" => $c["admin_username"],
            "role" => "admin",
            "username" => $c["admin_username"],
        ];
    }
    $row = one(
        database(),
        "SELECT id,name,username,role,active,version FROM staff_accounts WHERE id=? AND owner=?",
        [$_SESSION["staff_id"], $c["owner_id"] ?? "ejaz-admin"],
    );
    if (
        !$row ||
        !(int) $row["active"] ||
        (int) $row["version"] !== (int) ($_SESSION["staff_version"] ?? 0)
    ) {
        json_response(["error" => "انتهت صلاحية الحساب؛ سجّل الدخول مجددًا."], 401);
    }
    return $row;
}
function allow_action(string $action): bool
{
    $role = actor_info()["role"];
    return $role === "admin" ||
        in_array(
            $action,
            match ($role) {
                "reviewer" => ["view", "edit", "export", "review"],
                "importer" => ["view", "create"],
                "viewer" => ["view"],
                default => [],
            },
            true,
        );
}
function need_action(string $action): void
{
    if (!allow_action($action)) {
        json_response(["error" => "ليس لديك صلاحية لهذه العملية."], 403);
    }
}
function audit_event(
    PDO $db,
    string $owner,
    string $action,
    ?string $record = null,
    string $detail = "",
): void {
    $actor = actor_info();
    query(
        $db,
        "INSERT INTO activity_events(id,owner,actor,action,record_id,detail,created) VALUES(?,?,?,?,?,?,?)",
        [uuid(), $owner, $actor["username"], $action, $record, cut_text($detail, 4000), now_iso()],
    );
}
function workspace_routes(PDO $db, string $owner, string $resource, string $method): void
{
    if ($resource === "workspace/me" && $method === "GET") {
        json_response([
            "user" => actor_info(),
            "permissions" => array_values(
                array_filter(
                    ["view", "create", "edit", "export", "review", "manage"],
                    fn($a) => allow_action($a),
                ),
            ),
        ]);
    }
    if ($resource === "workspace/meta" && $method === "PUT") {
        need_action("edit");
        $b = read_json();
        $id = (string) ($b["id"] ?? "");
        $status = (string) ($b["status"] ?? "");
        if (!in_array($status, ["available", "reserved", "contracted", "excluded"], true)) {
            json_response(["error" => "الحالة غير صالحة."], 400);
        }
        $db->beginTransaction();
        $r = one($db, "SELECT id,version FROM records WHERE id=? AND owner=? FOR UPDATE", [
            $id,
            $owner,
        ]);
        if (!$r) {
            json_response(["error" => "السجل غير موجود."], 404);
        }
        if ((int) $r["version"] !== (int) ($b["version"] ?? 0)) {
            json_response(["error" => "تم تعديل السيرة؛ حدّث الصفحة."], 409);
        }
        query(
            $db,
            "INSERT INTO record_meta(record_id,owner,status,note,updated) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),note=VALUES(note),updated=VALUES(updated)",
            [$id, $owner, $status, cut_text((string) ($b["note"] ?? ""), 4000), now_iso()],
        );
        query($db, "UPDATE records SET version=version+1,updated=? WHERE id=? AND owner=?", [
            now_iso(),
            $id,
            $owner,
        ]);
        audit_event($db, $owner, "status", $id, $status);
        $db->commit();
        json_response(["ok" => true]);
    }
    if ($resource === "workspace/activity" && $method === "GET") {
        need_action("manage");
        $page = max(1, (int) ($_GET["page"] ?? 1));
        $total = (int) one($db, "SELECT COUNT(*) AS n FROM activity_events WHERE owner=?", [
            $owner,
        ])["n"];
        json_response([
            "rows" => query(
                $db,
                "SELECT * FROM activity_events WHERE owner=? ORDER BY created DESC,id DESC LIMIT 50 OFFSET " .
                    ($page - 1) * 50,
                [$owner],
            )->fetchAll(),
            "total" => $total,
            "page" => $page,
        ]);
    }
    if ($resource === "workspace/history" && $method === "GET") {
        need_action("review");
        $id = (string) ($_GET["id"] ?? "");
        $rows = query(
            $db,
            "SELECT id,data,created FROM history WHERE record_id=? AND owner=? ORDER BY created DESC",
            [$id, $owner],
        )->fetchAll();
        foreach ($rows as &$r) {
            $r["data"] = json_decode($r["data"], true);
        }
        json_response(["rows" => $rows]);
    }
    if ($resource === "workspace/staff") {
        need_action("manage");
        if ($method === "GET") {
            json_response([
                "rows" => query(
                    $db,
                    "SELECT id,username,name,role,active,created FROM staff_accounts WHERE owner=? ORDER BY created DESC",
                    [$owner],
                )->fetchAll(),
            ]);
        }
        if ($method === "POST" || $method === "PUT") {
            $b = read_json();
            $id = (string) ($b["id"] ?? "");
            $role = (string) ($b["role"] ?? "");
            $username = trim((string) ($b["username"] ?? ""));
            $name = cut_text((string) ($b["name"] ?? ""), 255);
            $password = (string) ($b["password"] ?? "");
            if (
                !preg_match('/^[a-zA-Z0-9_.@-]{3,128}$/', $username) ||
                !$name ||
                !in_array($role, ["admin", "reviewer", "importer", "viewer"], true) ||
                strcasecmp($username, configuration()["admin_username"]) === 0
            ) {
                json_response(["error" => "راجع الاسم واسم الدخول والدور."], 400);
            }
            if (
                ($method === "POST" || $password !== "") &&
                (strlen($password) < 12 || strlen($password) > 128)
            ) {
                json_response(["error" => "كلمة المرور من 12 إلى 128 حرفًا."], 400);
            }
            $db->beginTransaction();
            if ($method === "POST") {
                $id = uuid();
                query(
                    $db,
                    "INSERT INTO staff_accounts(id,owner,username,name,password_hash,role,active,created) VALUES(?,?,?,?,?,?,1,?)",
                    [
                        $id,
                        $owner,
                        $username,
                        $name,
                        password_hash($password, PASSWORD_DEFAULT),
                        $role,
                        now_iso(),
                    ],
                );
            } else {
                if (
                    !one($db, "SELECT id FROM staff_accounts WHERE id=? AND owner=?", [$id, $owner])
                ) {
                    json_response(["error" => "الحساب غير موجود."], 404);
                }
                if ($id === (actor_info()["id"] ?? "")) {
                    json_response(["error" => "استخدم حساب المدير الرئيسي لتعديل حسابك."], 400);
                }
                query(
                    $db,
                    "UPDATE staff_accounts SET username=?,name=?,role=?,active=?,version=version+1 WHERE id=? AND owner=?",
                    [$username, $name, $role, empty($b["active"]) ? 0 : 1, $id, $owner],
                );
                if ($password !== "") {
                    query($db, "UPDATE staff_accounts SET password_hash=? WHERE id=? AND owner=?", [
                        password_hash($password, PASSWORD_DEFAULT),
                        $id,
                        $owner,
                    ]);
                }
            }
            audit_event($db, $owner, "staff", null, $username);
            $db->commit();
            json_response(["ok" => true]);
        }
    }
    if ($resource === "workspace/restore" && $method === "POST") {
        need_action("manage");
        if (($_POST["confirm"] ?? "") !== "RESTORE") {
            json_response(["error" => "أكّد الاستعادة."], 400);
        }
        $f = uploaded("backup", 100 * 1024 * 1024);
        if (!$f) {
            json_response(["error" => "اختر النسخة JSON."], 400);
        }
        $backup = json_decode((string) file_get_contents($f["tmp_name"]), true);
        $tables = $backup["tables"] ?? null;
        if (
            !is_array($tables) ||
            !isset($tables["records"], $tables["uploaded_files"], $tables["photos"])
        ) {
            json_response(["error" => "نسخة غير صالحة."], 400);
        }
        $allowed = [
            "registry" => ["id", "owner", "passport", "name", "created"],
            "records" => [
                "id",
                "owner",
                "passport",
                "name",
                "nationality",
                "data",
                "source",
                "filename",
                "photo",
                "created",
                "updated",
                "version",
            ],
            "history" => ["id", "owner", "record_id", "data", "source", "photo", "created"],
            "photos" => ["id", "owner", "mime", "data_hex", "created"],
            "uploaded_files" => ["file_key", "mime", "data_hex", "created"],
            "record_meta" => ["record_id", "owner", "status", "note", "updated"],
            "activity_events" => [
                "id",
                "owner",
                "actor",
                "action",
                "record_id",
                "detail",
                "created",
            ],
        ];
        $db->beginTransaction();
        $saved = 0;
        $skipped = 0;
        $ids = [];
        foreach ($tables["records"] as $row) {
            if (
                !is_array($row) ||
                !preg_match('/^[A-Z0-9]{5,20}$/', (string) ($row["passport"] ?? ""))
            ) {
                throw new RuntimeException("BACKUP_RECORD");
            }
            if (
                one($db, "SELECT id FROM records WHERE owner=? AND passport=?", [
                    $owner,
                    $row["passport"],
                ])
            ) {
                $skipped++;
                continue;
            }
            $ids[$row["id"]] = uuid();
        }
        $neededSources = [];
        $neededPhotos = [];
        foreach (array_merge($tables["records"], $tables["history"] ?? []) as $row) {
            $recordId = $row["record_id"] ?? $row["id"];
            if (!isset($ids[$recordId])) {
                continue;
            }
            if (!empty($row["source"])) {
                $neededSources[$row["source"]] = true;
            }
            if (!empty($row["photo"])) {
                $neededPhotos[substr($row["photo"], 3)] = true;
            }
        }
        $photoIds = [];
        foreach ($tables["photos"] as $row) {
            if (isset($neededPhotos[$row["id"]])) {
                $photoIds[$row["id"]] = uuid();
            }
        }
        $fileKeys = [];
        foreach ($tables["uploaded_files"] as $row) {
            if (isset($neededSources[$row["file_key"]])) {
                $fileKeys[$row["file_key"]] =
                    $owner . "/" . uuid() . "." . pathinfo($row["file_key"], PATHINFO_EXTENSION);
            }
        }
        foreach (
            [
                "uploaded_files",
                "photos",
                "registry",
                "records",
                "history",
                "record_meta",
                "activity_events",
            ]
            as $table
        ) {
            foreach ($tables[$table] ?? [] as $row) {
                if (!is_array($row)) {
                    throw new RuntimeException("BACKUP_ROW");
                }
                if (
                    in_array($table, ["records", "history", "record_meta"], true) &&
                    !isset($ids[$table === "records" ? $row["id"] : $row["record_id"]])
                ) {
                    continue;
                }
                if ($table === "uploaded_files" && !isset($fileKeys[$row["file_key"]])) {
                    continue;
                }
                if ($table === "photos" && !isset($photoIds[$row["id"]])) {
                    continue;
                }
                if (
                    $table === "registry" &&
                    one($db, "SELECT id FROM registry WHERE owner=? AND passport=?", [
                        $owner,
                        $row["passport"],
                    ])
                ) {
                    continue;
                }
                $row["owner"] = $owner;
                if ($table === "records") {
                    $row["id"] = $ids[$row["id"]];
                    $saved++;
                } elseif ($table === "photos") {
                    $row["id"] = $photoIds[$row["id"]];
                } elseif (isset($row["id"])) {
                    $row["id"] = uuid();
                }
                if (isset($row["record_id"])) {
                    if ($table === "activity_events" && !isset($ids[$row["record_id"]])) {
                        continue;
                    }
                    $row["record_id"] = $ids[$row["record_id"]];
                }
                if (isset($row["file_key"])) {
                    $row["file_key"] = $fileKeys[$row["file_key"]];
                }
                if (isset($row["source"])) {
                    $row["source"] =
                        $fileKeys[$row["source"]] ?? throw new RuntimeException("BACKUP_FILE");
                }
                if (!empty($row["photo"])) {
                    $row["photo"] =
                        "db:" .
                        ($photoIds[substr($row["photo"], 3)] ??
                            throw new RuntimeException("BACKUP_PHOTO"));
                }
                $cols = [];
                $args = [];
                foreach ($allowed[$table] as $col) {
                    if (!array_key_exists($col, $row)) {
                        throw new RuntimeException("BACKUP_COLUMN");
                    }
                    $value = $row[$col];
                    if ($col === "data_hex") {
                        if (!is_string($value) || strlen($value) % 2 || !ctype_xdigit($value)) {
                            throw new RuntimeException("BACKUP_BINARY");
                        }
                        $value = hex2bin($value);
                        check_binary_packet($db, strlen($value));
                        $col = "data";
                    }
                    $cols[] = "`" . $col . "`";
                    $args[] = $value;
                }
                query(
                    $db,
                    "INSERT INTO `" .
                        $table .
                        "` (" .
                        implode(",", $cols) .
                        ") VALUES (" .
                        implode(",", array_fill(0, count($args), "?")) .
                        ")",
                    $args,
                );
            }
        }
        $officeIds=[];
        foreach($tables['recruitment_offices']??[] as $office){
            if(!is_array($office)||!is_string($office['id']??null)||!is_string($office['name']??null))throw new RuntimeException('BACKUP_OFFICE');
            $name=cut_text($office['name'],200);if(!$name)throw new RuntimeException('BACKUP_OFFICE_NAME');
            $existing=one($db,'SELECT id FROM recruitment_offices WHERE owner=? AND name=?',[$owner,$name]);
            $newId=$existing['id']??uuid();$officeIds[$office['id']]=$newId;
            if(!$existing)query($db,'INSERT INTO recruitment_offices(id,owner,name,country,active,version,created,updated) VALUES(?,?,?,?,?,1,?,?)',[$newId,$owner,$name,cut_text((string)($office['country']??''),100),!empty($office['active'])?1:0,now_iso(),now_iso()]);
        }
        $restoredRecords=$ids;
        foreach($tables['records'] as $record){
            if(!isset($restoredRecords[$record['id']])){$existing=one($db,'SELECT id FROM records WHERE owner=? AND passport=?',[$owner,$record['passport']]);if($existing)$restoredRecords[$record['id']]=$existing['id'];}
        }
        foreach($tables['office_records']??[] as $link){
            if(!is_array($link))throw new RuntimeException('BACKUP_OFFICE_LINK');
            $recordId=$restoredRecords[$link['record_id']??'']??null;$officeId=$officeIds[$link['office_id']??'']??null;
            if($recordId&&$officeId&&!one($db,'SELECT record_id FROM office_records WHERE record_id=? AND owner=?',[$recordId,$owner]))query($db,'INSERT INTO office_records(record_id,owner,office_id,created) VALUES(?,?,?,?)',[$recordId,$owner,$officeId,now_iso()]);
        }
        foreach($tables['tickets']??[] as $ticket){
            if(!is_array($ticket)||!is_string($ticket['original_data_hex']??null)||strlen($ticket['original_data_hex'])%2||!ctype_xdigit($ticket['original_data_hex']))throw new RuntimeException('BACKUP_TICKET');
            $bytes=hex2bin($ticket['original_data_hex']);$hash=hash('sha256',$bytes);
            if(one($db,'SELECT id FROM tickets WHERE owner=? AND file_hash=?',[$owner,$hash])){$skipped++;continue;}
            check_binary_packet($db,strlen($bytes));
            $data=json_decode((string)($ticket['data']??''),true);if(!is_array($data))throw new RuntimeException('BACKUP_TICKET_DATA');
            $clean=clean_ticket($data);
            $oldOffice=$clean['officeId'];$clean['officeId']=$officeIds[$oldOffice]??'';
            $newOffice=$clean['officeId']?office_get($db,$owner,$clean['officeId']):null;$clean['officeName']=$newOffice['name']??'';
            foreach($clean['passengers'] as &$person){$person['cvRecordId']=$restoredRecords[$person['cvRecordId']]??'';$person['identitySource']=$person['cvRecordId']?'CV: '.$person['cvRecordId']:'';}unset($person);
            $ticket['data']=json_encode($clean,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
            $image=@getimagesizefromstring($bytes);$mime=str_starts_with($bytes,'%PDF-')?'application/pdf':($image&&in_array($image['mime'],['image/jpeg','image/png','image/webp'],true)?$image['mime']:'');if(!$mime)throw new RuntimeException('BACKUP_TICKET_FILE');$ticket['mime']=$mime;
            $columns=['id','owner','booking_reference','ticket_number','passenger_name','passport','airline','departure_date','arrival_date','origin','destination','data','filename','mime','original_data','file_hash','reviewed','created','updated','version'];
            $ticket['id']=uuid();$ticket['owner']=$owner;$ticket['original_data']=$bytes;$ticket['file_hash']=$hash;
            foreach($columns as $column)if(!array_key_exists($column,$ticket))throw new RuntimeException('BACKUP_TICKET_COLUMN');
            query($db,'INSERT INTO tickets (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')',array_map(fn($key)=>$ticket[$key],$columns));$saved++;
        }
        audit_event($db, $owner, "restore", null, "restored=" . $saved . " skipped=" . $skipped);
        $db->commit();
        json_response(["restored" => $saved, "skipped" => $skipped]);
    }
}

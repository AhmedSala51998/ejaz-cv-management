<?php
declare(strict_types=1);
class TestPDO extends PDO {public function __construct(){}}
class ApiFailure extends Exception {public function __construct(public int $status){parent::__construct('API '.$status);}}
function json_response(array $body,int $status=200): never {throw new ApiFailure($status);}
function one(PDO $db,string $sql,array $args=[]): ?array {
 $rows=['et'=>['id'=>'et','name'=>'Ethiopia Office','country'=>'ETHIOPIAN','active'=>1],'so'=>['id'=>'so','name'=>'Somalia Office','country'=>'SOMALI','active'=>1],'blank'=>['id'=>'blank','name'=>'Incomplete','country'=>'','active'=>1],'off'=>['id'=>'off','name'=>'Disabled','country'=>'KENYAN','active'=>0]];
 return ($args[0]??'')==='owner'?($rows[$args[1]??'']??null):null;
}
require dirname(__DIR__).'/private/offices.php';
$db=new TestPDO();$checks=0;
function check(bool $v):void{global $checks;if(!$v)throw new Exception('Assertion failed');$checks++;}
function rejected(callable $fn,int $status):void{try{$fn();throw new Exception('Expected rejection');}catch(ApiFailure $e){check($e->status===$status);}}
$t=ticket_office_context($db,'owner',['officeId'=>'et','sourceCountry'=>'','officeName'=>'Fake'],true,true);
check($t['sourceCountry']==='ETHIOPIAN'&&$t['officeName']==='Ethiopia Office');
check(ticket_office_context($db,'owner',['officeId'=>'so','sourceCountry'=>'SOMALI'],true,true)['sourceCountry']==='SOMALI');
rejected(fn()=>ticket_office_context($db,'owner',['officeId'=>'et','sourceCountry'=>'SOMALI'],true,true),409);
rejected(fn()=>office_candidates($db,'owner',['officeId'=>'et','sourceCountry'=>'SOMALI','passengers'=>[]]),409);
rejected(fn()=>ticket_office_context($db,'owner',['officeId'=>'blank'],true,true),400);
rejected(fn()=>ticket_office_context($db,'other-owner',['officeId'=>'et'],true,true),400);
rejected(fn()=>ticket_office_context($db,'owner',['officeId'=>'missing'],true,true),400);
rejected(fn()=>ticket_office_context($db,'owner',['officeId'=>'off'],true,true),400);
rejected(fn()=>ticket_office_context($db,'owner',[],true,true),400);
check(ticket_office_context($db,'owner',['officeId'=>'','sourceCountry'=>''],false)===['officeId'=>'','sourceCountry'=>'']);
echo "PASS: $checks country-binding checks (database lookup stubbed), canonical office country, save/search tamper rejection, missing country, disabled/foreign/missing office, legacy unassigned ticket.\n";

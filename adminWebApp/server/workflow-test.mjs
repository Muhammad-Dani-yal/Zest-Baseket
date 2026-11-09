import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const base='http://127.0.0.1:3001/api/';
const request=async(path,method='GET',data,cookie)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
const env=Object.fromEntries(readFileSync('.env','utf8').trim().split(/\r?\n/).map(l=>l.split('=')));
const db=new DatabaseSync('data/zestbasket.sqlite');
const email='workflow.'+Date.now()+'@example.com',password='Initial-'+Date.now(),newPassword='Changed-'+Date.now();
let employeeId,followupId,riderId,original;
try {
 const admin=await request('login','POST',{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD});assert.equal(admin.status,200);
 assert.equal((await request('customers','POST',{name:'Should not exist',email:'nobody@example.com'},admin.cookie)).status,403);
 assert.equal((await request('employees','POST',{name:'Workflow QA',email,password,department:'Operations'},admin.cookie)).status,201);
 employeeId=(await request('employees','GET',undefined,admin.cookie)).data.find(u=>u.email===email).id;
 assert.equal((await request('employees/'+employeeId,'PATCH',{email:'changed@example.com',active:true},admin.cookie)).status,400);
 const employee=await request('login','POST',{email,password});assert.equal(employee.status,200);
 const second=await request('login','POST',{email,password});assert.equal(second.status,200);
 assert.equal((await request('me','PATCH',{email:'changed@example.com'},employee.cookie)).status,405);
 assert.equal((await request('account/password','POST',{currentPassword:'wrong',newPassword},employee.cookie)).status,400);
 assert.equal((await request('account/password','POST',{currentPassword:password,newPassword,email:'changed@example.com'},employee.cookie)).status,400);
 assert.equal((await request('account/password','POST',{currentPassword:password,newPassword:'short'},employee.cookie)).status,400);
 assert.equal((await request('account/password','POST',{currentPassword:password,newPassword},employee.cookie)).status,200);
 assert.equal((await request('me','GET',undefined,employee.cookie)).data.email,email);
 assert.equal((await request('me','GET',undefined,second.cookie)).status,401);
 assert.equal((await request('login','POST',{email,password})).status,401);
 const relogin=await request('login','POST',{email,password:newPassword});assert.equal(relogin.status,200);
 assert.equal((await request('employees','POST',{name:'Blocked'},relogin.cookie)).status,403);
 const items=await request('inventory','GET',undefined,relogin.cookie);const item=items.data[0];
 assert.equal((await request('followups','POST',{productId:'unknown',message:'Restock',dueDate:'2026-12-01'},relogin.cookie)).status,400);
 assert.equal((await request('followups','POST',{productId:item.id,message:'QA restock request',dueDate:'2026-12-01',shop:'Forged shop',assignedBy:'Someone else'},relogin.cookie)).status,201);
 const followup=(await request('followups','GET',undefined,relogin.cookie)).data.find(f=>f.message==='QA restock request');followupId=followup.id;assert.equal(followup.shop,item.shop);assert.equal(followup.assignedBy,'Workflow QA');
 assert.equal((await request('followups/'+followup.id,'PATCH',{status:'Contacted'},relogin.cookie)).status,200);
 assert.equal((await request('followups/'+followup.id,'PATCH',{status:'Invalid'},relogin.cookie)).status,400);
 const rider=(await request('riders','GET',undefined,relogin.cookie)).data[0];riderId=rider.id;original=db.prepare('SELECT data FROM records WHERE id=?').get(riderId).data;
 assert.equal((await request('riders/'+riderId,'PATCH',{latitude:91,longitude:67},relogin.cookie)).status,400);
 assert.equal((await request('riders/'+riderId,'PATCH',{latitude:24.8615,longitude:67.0099},relogin.cookie)).status,200);
 const location=(await request('rider-locations','GET',undefined,relogin.cookie)).data.find(r=>r.id===riderId);assert.equal(location.latitude,24.8615);assert.equal(location.longitude,67.0099);assert.equal(location.source,'Recorded location');assert.ok(location.locationUpdatedAt);
 assert.ok(!(await request('employees','GET',undefined,admin.cookie)).data.some(u=>'password' in u));
 await request('logout','POST',{},admin.cookie);
 console.log('PASS: no customer creation, employee credentials/login, immutable email, password validation/change, old-password rejection, other-session revocation, employee restrictions, stock follow-up ownership/status, recorded rider coordinates.');
} finally {
 if(original)db.prepare('UPDATE records SET data=? WHERE id=?').run(original,riderId);
 if(followupId)db.prepare('DELETE FROM records WHERE id=?').run(followupId);
 if(employeeId){db.prepare('DELETE FROM sessions WHERE user_id=?').run(employeeId);db.prepare('DELETE FROM users WHERE id=?').run(employeeId);}
 db.prepare("DELETE FROM audit WHERE actor='Workflow QA' OR action=?").run('Created employee '+email);db.close();
}

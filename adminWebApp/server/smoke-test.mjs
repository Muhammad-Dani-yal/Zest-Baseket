import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const base='http://127.0.0.1:3001/api/';
const request=async(path,method='GET',data,cookie)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
assert.equal((await request('orders')).status,401);
assert.equal((await request('login','POST',{email:'invalid@example.com',password:'wrong'})).status,401);
const env=Object.fromEntries(readFileSync('.env','utf8').trim().split('\n').map(l=>l.split('=')));
const admin=await request('login','POST',{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD});assert.equal(admin.status,200);assert.equal(admin.data.role,'admin');assert.ok(!admin.data.password);
const email='test.'+Date.now()+'@example.com';const password='Test-'+Date.now();assert.equal((await request('employees','POST',{name:'Access Test',email,password,department:'Operations'},admin.cookie)).status,201);
const employee=await request('login','POST',{email,password});assert.equal(employee.status,200);
assert.equal((await request('employees','POST',{name:'Unauthorized'},employee.cookie)).status,403);
for(const p of ['employees','settings','payments','audit','customers'])assert.equal((await request(p,'GET',undefined,employee.cookie)).status,403);
for(const p of ['orders','shops','riders','inventory','refunds','tickets'])assert.equal((await request(p,'GET',undefined,employee.cookie)).status,200);
assert.equal((await request('register','POST',{email,password})).status,401);
const orders=await request('orders','GET',undefined,employee.cookie);const order=orders.data[0];assert.equal((await request('orders/'+order.id,'PATCH',{status:'INVALID'},employee.cookie)).status,400);
assert.equal((await request('orders/'+order.id,'PATCH',{status:'Preparing'},employee.cookie)).status,200);assert.equal((await request('orders','GET',undefined,employee.cookie)).data.find(o=>o.id===order.id).status,'Preparing');await request('orders/'+order.id,'PATCH',{status:order.status},admin.cookie);
const users=await request('employees','GET',undefined,admin.cookie);const u=users.data.find(u=>u.email===email);await request('employees/'+u.id,'PATCH',{active:false},admin.cookie);assert.equal((await request('me','GET',undefined,employee.cookie)).status,401);assert.equal((await request('login','POST',{email,password})).status,401);
assert.equal((await request('orders','POST',{},admin.cookie)).status,400);
assert.equal((await request('logout','POST',{},admin.cookie)).status,200);assert.equal((await request('me','GET',undefined,admin.cookie)).status,401);
console.log('PASS: authentication, admin-only provisioning, role permissions, status updates, persisted changes, account disable, session revocation, logout.');

const db=new DatabaseSync('data/zestbasket.sqlite');
for(const u of db.prepare("SELECT id FROM users WHERE email LIKE 'test.%@example.com' AND name='Access Test'").all()){db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);db.prepare('DELETE FROM users WHERE id=?').run(u.id);}
db.prepare("DELETE FROM audit WHERE actor='Access Test' OR action LIKE 'Created employee test.%' OR action LIKE 'Updated employee access %'").run();db.close();

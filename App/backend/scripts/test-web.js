/**
 * Verification test script for LRVS Web Application
 * Tests Browser Auth, Cookie, Dashboards, and RBAC
 */

'use strict';

const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../src/app');

async function runTests() {
  console.log('🧪 Starting LRVS Web Application Integration Tests...\n');

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sih26016');
    console.log('✅ Connected to MongoDB\n');

    let passed = 0;
    let failed = 0;

    function assert(desc, condition, extra = '') {
      if (condition) {
        console.log(`  ✅ PASS: ${desc}`);
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${desc} ${extra}`);
        failed++;
      }
    }

    // 1. GET /login
    console.log('1. Testing GET /login (Login Page Rendering)');
    const loginRes = await request(app).get('/login').set('Accept', 'text/html');
    assert('Status is 200', loginRes.status === 200);
    assert('Returns HTML content', loginRes.type === 'text/html');
    assert('Contains User ID input', loginRes.text.includes('id="login-id"'));
    assert('Contains Password input', loginRes.text.includes('id="login-password"'));
    assert('Contains Sign In button', loginRes.text.includes('Sign In to Account') || loginRes.text.includes('Sign In'));

    // 2. POST /login with invalid credentials
    console.log('\n2. Testing POST /login with invalid credentials');
    const badLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'DIST-001', password: 'WrongPassword' });
    assert('Status is 401', badLogin.status === 401);
    assert('Shows error message in HTML', badLogin.text.includes('Invalid ID or password.'));

    // 3. POST /login with valid District Officer credentials
    console.log('\n3. Testing POST /login with DIST-001 (District Collector)');
    const distLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'DIST-001', password: 'Pass@1234' });
    
    assert('Redirects with 302', distLogin.status === 302);
    assert('Redirects to /dashboard/district', distLogin.header['location'] === '/dashboard/district');
    
    const setCookie = distLogin.header['set-cookie'];
    assert('Sets token cookie', Array.isArray(setCookie) && setCookie.some(c => c.startsWith('token=')));
    const distCookie = setCookie ? setCookie.find(c => c.startsWith('token=')) : '';

    // 4. GET /dashboard/district with auth cookie
    console.log('\n4. Testing GET /dashboard/district with auth cookie');
    const distDash = await request(app)
      .get('/dashboard/district')
      .set('Cookie', distCookie)
      .set('Accept', 'text/html');
    
    assert('Status is 200', distDash.status === 200);
    assert('Renders district dashboard', distDash.text.includes('District') || distDash.text.includes('Pune'));
    assert('Contains navbar with user info', distDash.text.includes('DIST-001'));

    // 5. RBAC enforcement: DIST-001 cannot access Admin Dashboard
    console.log('\n5. Testing RBAC: DIST-001 accessing /dashboard/admin (Should be 403)');
    const forbidden = await request(app)
      .get('/dashboard/admin')
      .set('Cookie', distCookie)
      .set('Accept', 'text/html');
    
    assert('Status is 403 Forbidden', forbidden.status === 403);
    assert('Renders 403 error page', forbidden.text.includes('403') || forbidden.text.includes('Access Denied'));

    // 6. POST /login with SUPER-001 (Super Admin)
    console.log('\n6. Testing POST /login with SUPER-001 (Super Admin)');
    const adminLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'SUPER-001', password: 'Pass@1234' });
    
    assert('Redirects with 302', adminLogin.status === 302);
    assert('Redirects to /dashboard/admin', adminLogin.header['location'] === '/dashboard/admin');
    const adminCookie = adminLogin.header['set-cookie']?.find(c => c.startsWith('token='));

    // 7. GET /dashboard/admin with SUPER-001 cookie
    console.log('\n7. Testing GET /dashboard/admin with Super Admin cookie');
    const adminDash = await request(app)
      .get('/dashboard/admin')
      .set('Cookie', adminCookie)
      .set('Accept', 'text/html');
    
    assert('Status is 200', adminDash.status === 200);
    assert('Renders admin dashboard', adminDash.text.includes('System Administration') || adminDash.text.includes('Super Administrator'));

    // 8. GET /land/requests (List land records)
    console.log('\n8. Testing GET /land/requests');
    const landReqs = await request(app)
      .get('/land/requests')
      .set('Cookie', adminCookie)
      .set('Accept', 'text/html');
    
    assert('Status is 200', landReqs.status === 200);
    assert('Contains sample records', landReqs.text.includes('Mumbai-Pune Expressway') || landReqs.text.includes('NHAI-MH-2024-001'));

    // 9. GET /map (GIS Map)
    console.log('\n9. Testing GET /map');
    const mapRes = await request(app)
      .get('/map')
      .set('Cookie', adminCookie)
      .set('Accept', 'text/html');
    
    assert('Status is 200', mapRes.status === 200);
    assert('Contains map container', mapRes.text.includes('id="map"') || mapRes.text.includes('GIS'));

    // 10. GET /system/status (System Diagnostics)
    console.log('\n10. Testing GET /system/status');
    const sysRes = await request(app)
      .get('/system/status')
      .set('Cookie', adminCookie)
      .set('Accept', 'text/html');
    
    assert('Status is 200', sysRes.status === 200);
    assert('Contains MongoDB status', sysRes.text.includes('MongoDB') && sysRes.text.includes('UP'));

    // 11. Central Authority Dashboard
    console.log('\n11. Testing CENTRAL-001 login and Central Dashboard');
    const centralLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'CENTRAL-001', password: 'Pass@1234' });
    assert('Redirects to /dashboard/central', centralLogin.header['location'] === '/dashboard/central');
    const centralCookie = centralLogin.header['set-cookie']?.find(c => c.startsWith('token='));
    const centralDash = await request(app).get('/dashboard/central').set('Cookie', centralCookie).set('Accept', 'text/html');
    assert('Central Dashboard renders 200', centralDash.status === 200);

    // 12. State Authority Dashboard
    console.log('\n12. Testing STATE-001 login and State Dashboard');
    const stateLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'STATE-001', password: 'Pass@1234' });
    assert('Redirects to /dashboard/state', stateLogin.header['location'] === '/dashboard/state');
    const stateCookie = stateLogin.header['set-cookie']?.find(c => c.startsWith('token='));
    const stateDash = await request(app).get('/dashboard/state').set('Cookie', stateCookie).set('Accept', 'text/html');
    assert('State Dashboard renders 200', stateDash.status === 200);

    // 13. Verification Officer Dashboard & Queue
    console.log('\n13. Testing VERIFY-001 login, Dashboard & Queue');
    const verifyLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'VERIFY-001', password: 'Pass@1234' });
    assert('Redirects to /dashboard/verification', verifyLogin.header['location'] === '/dashboard/verification');
    const verifyCookie = verifyLogin.header['set-cookie']?.find(c => c.startsWith('token='));
    const verifyDash = await request(app).get('/dashboard/verification').set('Cookie', verifyCookie).set('Accept', 'text/html');
    assert('Verification Dashboard renders 200', verifyDash.status === 200);
    const verifyQueue = await request(app).get('/verification/queue').set('Cookie', verifyCookie).set('Accept', 'text/html');
    assert('Verification Queue renders 200', verifyQueue.status === 200);

    // 14. Project Officer Dashboard
    console.log('\n14. Testing PROJECT-001 login and Dashboard');
    const projLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'PROJECT-001', password: 'Pass@1234' });
    assert('Redirects to /dashboard/project-officer', projLogin.header['location'] === '/dashboard/project-officer');
    const projCookie = projLogin.header['set-cookie']?.find(c => c.startsWith('token='));
    const projDash = await request(app).get('/dashboard/project-officer').set('Cookie', projCookie).set('Accept', 'text/html');
    assert('Project Officer Dashboard renders 200', projDash.status === 200);

    // 15. Finance Officer Dashboard
    console.log('\n15. Testing FIN-001 login and Dashboard');
    const finLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'FIN-001', password: 'Pass@1234' });
    assert('Redirects to /dashboard/finance', finLogin.header['location'] === '/dashboard/finance');
    const finCookie = finLogin.header['set-cookie']?.find(c => c.startsWith('token='));
    const finDash = await request(app).get('/dashboard/finance').set('Cookie', finCookie).set('Accept', 'text/html');
    assert('Finance Dashboard renders 200', finDash.status === 200);

    // 16. Land Owner Dashboard
    console.log('\n16. Testing LAND-001 login and Dashboard');
    const landLogin = await request(app)
      .post('/login')
      .set('Accept', 'text/html')
      .send({ id: 'LAND-001', password: 'Pass@1234' });
    assert('Redirects to /dashboard/land-owner', landLogin.header['location'] === '/dashboard/land-owner');
    const landCookie = landLogin.header['set-cookie']?.find(c => c.startsWith('token='));
    const landDash = await request(app).get('/dashboard/land-owner').set('Cookie', landCookie).set('Accept', 'text/html');
    assert('Land Owner Dashboard renders 200', landDash.status === 200);

    // 17. Approvals Queue (Authority Tier)
    console.log('\n17. Testing GET /approvals/queue');
    const apprQueue = await request(app).get('/approvals/queue').set('Cookie', adminCookie).set('Accept', 'text/html');
    assert('Approvals Queue renders 200', apprQueue.status === 200);

    // 18. Audit Log (Admin)
    console.log('\n18. Testing GET /audit');
    const auditRes = await request(app).get('/audit').set('Cookie', adminCookie).set('Accept', 'text/html');
    assert('Audit Trail renders 200', auditRes.status === 200);

    // 19. Detail Views (Land, Verification, Compensation)
    console.log('\n19. Testing Detail Views (/land/:id, /verification/:id, /compensation/:id)');
    const LandRecord = require('../src/models/LandRecord');
    const sampleRecord = await LandRecord.findOne();
    if (sampleRecord) {
      const landDetailRes = await request(app).get(`/land/${sampleRecord.requestId}`).set('Cookie', adminCookie).set('Accept', 'text/html');
      assert('Land Detail renders 200', landDetailRes.status === 200);

      const verifyDetailRes = await request(app).get(`/verification/${sampleRecord.requestId}`).set('Cookie', adminCookie).set('Accept', 'text/html');
      assert('Verification Detail renders 200', verifyDetailRes.status === 200);

      const compDetailRes = await request(app).get(`/compensation/${sampleRecord.requestId}`).set('Cookie', adminCookie).set('Accept', 'text/html');
      assert('Compensation Detail renders 200', compDetailRes.status === 200);
    }

    // 20. POST /logout
    console.log('\n20. Testing POST /logout');
    const logoutRes = await request(app).post('/logout').set('Cookie', adminCookie).set('Accept', 'text/html');
    assert('Redirects to /login on logout', logoutRes.status === 302 && logoutRes.header['location'] === '/login');
    assert('Clears token cookie', logoutRes.header['set-cookie']?.some(c => c.includes('token=;')));

    // Summary
    console.log('\n' + '━'.repeat(50));
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('━'.repeat(50) + '\n');

    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();

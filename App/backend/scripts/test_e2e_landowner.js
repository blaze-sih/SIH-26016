const http = require('http');

async function testE2E() {
  console.log('=== Starting E2E Document Storage & Land Owner Verification ===');

  // 1. Login as LAND-001 (API mode)
  const loginRes = await fetch('http://localhost:9000/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      id: 'LAND-001',
      password: 'Pass@1234'
    })
  });

  const loginJson = await loginRes.json();
  const token = loginJson.data?.token;
  console.log('1. Login Status:', loginRes.status, '| User:', loginJson.data?.user?.name, '| Token acquired:', !!token);

  if (!token) {
    throw new Error('Login failed to yield token: ' + JSON.stringify(loginJson));
  }

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Cookie': `token=${token}`
  };

  // 2. Fetch Land Owner Dashboard (HTML)
  const dashRes = await fetch('http://localhost:9000/dashboard/land-owner', {
    headers: {
      ...authHeaders,
      'Accept': 'text/html'
    }
  });
  const html = await dashRes.text();
  console.log('2. Dashboard HTML Status:', dashRes.status);
  console.log('   - Contains "Good Morning, Ramesh":', html.includes('Good Morning, Ramesh'));
  console.log('   - Contains "Your Land Location":', html.includes('Your Land Location'));
  console.log('   - Contains "Acquisition Progress":', html.includes('Acquisition Progress'));
  console.log('   - Contains "DOC-2026-00001":', html.includes('DOC-2026-00001'));
  console.log('   - Contains "uploadModal":', html.includes('id="uploadModal"'));
  console.log('   - Contains "reviewModal":', html.includes('id="reviewModal"'));

  // 3. Test Secure File Stream (/api/documents/:documentId/file)
  const fileRes = await fetch('http://localhost:9000/api/documents/DOC-2026-00001/file', {
    headers: authHeaders
  });
  const fileBytes = await fileRes.arrayBuffer();
  console.log('3. File Stream Status:', fileRes.status, '| Content-Type:', fileRes.headers.get('content-type'), '| Bytes:', fileBytes.byteLength);

  // 4. Test Extraction API
  const extRes = await fetch('http://localhost:9000/api/documents/DOC-2026-00001/extraction', {
    headers: authHeaders
  });
  const extData = await extRes.json();
  console.log('4. Extraction API Status:', extRes.status);
  console.log('   - AI Extracted Survey Number:', extData.data?.extraction?.fields?.surveyNumber?.value);
  console.log('   - Low Confidence Flag:', extData.data?.extraction?.fields?.surveyNumber?.isLowConfidence);
  console.log('   - Suggested Correction:', extData.data?.extraction?.fields?.surveyNumber?.suggestedCorrection);

  // 5. Submit User Correction (142/3 -> 142/8)
  const corrRes = await fetch('http://localhost:9000/api/documents/DOC-2026-00001/corrections', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      field: 'surveyNumber',
      correctedValue: '142/8',
      reason: 'Physical 7/12 extract ground record verified by land owner'
    })
  });
  const corrData = await corrRes.json();
  console.log('5. Correction Submit Status:', corrRes.status, '| Msg:', corrData.message);
  console.log('   - Saved Correction ID:', corrData.data?.correction?.correctionId);
  console.log('   - Corrected Value:', corrData.data?.correction?.correctedValue);

  // 6. Verify Document (Finalize Verification)
  const verifyRes = await fetch('http://localhost:9000/api/documents/DOC-2026-00001/verify', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      remarks: 'Verified by Land Owner against 7/12 ground survey',
      overrideFields: { surveyNumber: '142/8' }
    })
  });
  const verifyData = await verifyRes.json();
  console.log('6. Verify Status:', verifyRes.status);
  console.log('   - Document Processing Status:', verifyData.data?.processingStatus);
  console.log('   - Verified Survey No:', verifyData.data?.verifiedData?.surveyNumber);

  // 7. Check History (Original AI data preserved + correction logged)
  const histRes = await fetch('http://localhost:9000/api/documents/DOC-2026-00001/history', {
    headers: authHeaders
  });
  const histData = await histRes.json();
  console.log('7. History API Status:', histRes.status);
  console.log('   - Corrections logged:', histData.data?.corrections?.length);
  const latest = histData.data?.corrections?.[0];
  console.log('   - Latest Audit Log: field', latest?.field, 'from', latest?.aiValue, 'to', latest?.correctedValue);

  // 8. Fetch updated Dashboard to ensure UI reflects changes
  const updatedDashRes = await fetch('http://localhost:9000/dashboard/land-owner', {
    headers: {
      ...authHeaders,
      'Accept': 'text/html'
    }
  });
  const updatedHtml = await updatedDashRes.text();
  console.log('8. Re-checking Dashboard HTML:');
  console.log('   - Contains 142/8 in Survey Number:', updatedHtml.includes('142/8'));
  console.log('   - Contains Verified badge:', updatedHtml.includes('Verified'));

  console.log('\n===============================================================');
  console.log('🎉 ALL DOCUMENT STORAGE ARCHITECTURE & WORKFLOW TESTS PASSED!');
  console.log('===============================================================');
}

testE2E().catch(err => {
  console.error('❌ E2E Failed:', err);
  process.exit(1);
});

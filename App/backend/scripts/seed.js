/**
 * LRVS — Demo Data Seed Script
 * Team BLAZE | SIH26016
 *
 * Creates demo user accounts and sample land records.
 * Run: node scripts/seed.js
 * Reset: node scripts/seed.js --reset
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load models
const User = require('../src/models/User');
const LandRecord = require('../src/models/LandRecord');

const DEMO_PASSWORD = 'Pass@1234';

const demoUsers = [
  {
    userId: 'SUPER-001',
    name: 'Super Administrator',
    email: 'admin@lrvs.gov.in',
    role: 'SUPER_ADMIN',
    department: 'Administration',
    isActive: true,
  },
  {
    userId: 'CENTRAL-001',
    name: 'A. Sharma',
    email: 'central@lrvs.gov.in',
    role: 'CENTRAL_AUTHORITY',
    department: 'Ministry of Land Resources',
    isActive: true,
  },
  {
    userId: 'STATE-001',
    name: 'S. Deshmukh',
    email: 'state@lrvs.gov.in',
    role: 'STATE_AUTHORITY',
    department: 'Revenue and Forest Department',
    state: 'Maharashtra',
    isActive: true,
  },
  {
    userId: 'DIST-001',
    name: 'D. Nair',
    email: 'dist.nashik@lrvs.gov.in',
    role: 'DISTRICT_AUTHORITY',
    department: 'District Collectorate',
    state: 'Maharashtra',
    district: 'Nashik',
    isActive: true,
  },
  {
    userId: 'DIST-002',
    name: 'District Collector — Pune',
    email: 'dist.pune@lrvs.gov.in',
    role: 'DISTRICT_AUTHORITY',
    department: 'District Administration',
    state: 'Maharashtra',
    district: 'Pune',
    isActive: true,
  },
  {
    userId: 'VERIFY-001',
    name: 'Data Checker Officer',
    email: 'verify@lrvs.gov.in',
    role: 'VERIFICATION_OFFICER',
    department: 'Verification Unit',
    state: 'Maharashtra',
    district: 'Pune',
    isActive: true,
  },
  {
    userId: 'PROJECT-001',
    name: 'Project Officer — NHAI',
    email: 'project@lrvs.gov.in',
    role: 'PROJECT_OFFICER',
    department: 'NHAI',
    state: 'Maharashtra',
    isActive: true,
  },
  {
    userId: 'FIN-001',
    name: 'Finance Officer',
    email: 'finance@lrvs.gov.in',
    role: 'FINANCE_OFFICER',
    department: 'Finance Department',
    state: 'Maharashtra',
    isActive: true,
  },
  {
    userId: 'LAND-001',
    name: 'Ramesh Patil',
    email: 'ramesh.patil@gmail.com',
    role: 'LAND_OWNER',
    state: 'Maharashtra',
    district: 'Pune',
    phone: '9876543210',
    isActive: true,
  },
  {
    userId: 'LAND-002',
    name: 'Sunita Desai',
    role: 'LAND_OWNER',
    state: 'Maharashtra',
    district: 'Dhule',
    phone: '9876543211',
    isActive: true,
  },
  // ── Simplified login spec (SIH 26016) ────────────────────────────────────
  {
    userId: 'USER-001',
    name: 'Citizen User',
    email: 'user@lrvs.gov.in',
    role: 'USER',
    isActive: true,
  },
  {
    userId: 'OFFICER-001',
    name: 'Field Officer',
    email: 'officer@lrvs.gov.in',
    role: 'OFFICER',
    department: 'Revenue Department',
    state: 'Maharashtra',
    isActive: true,
  },
];

const sampleLandRecords = [
  {
    projectId: 'NHAI-MH-2024-001',
    projectName: 'Mumbai-Pune Expressway Widening',
    registrationNumber: 'MH-PUNE-2024-0001',
    surveyNumber: 'SV-1234/A',
    state: 'Maharashtra',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Uruli Kanchan',
    status: 'SUBMITTED',
    landType: 'Agricultural',
    acquisitionPurpose: 'Highway widening — NHAI NH-48',
    acquisitionAuthority: 'National Highway Authority of India',
    area: { total: '2.5 Hectares', unit: 'Hectares', cultivable: '2.0', uncultivable: '0.5' },
    owners: [
      { name: 'Ramesh Baburao Patil', fatherName: 'Baburao Patil', share: '1/2' },
      { name: 'Suresh Baburao Patil', fatherName: 'Baburao Patil', share: '1/2' },
    ],
    location: { latitude: 18.5204, longitude: 73.8567 },
    affectedFamilies: 2,
    displacedFamilies: 1,
  },
  {
    projectId: 'MSRDC-MH-2024-001',
    projectName: 'Pune Ring Road Phase 1',
    registrationNumber: 'MH-PUNE-2024-0002',
    surveyNumber: 'SV-5678/B',
    state: 'Maharashtra',
    district: 'Pune',
    taluka: 'Mulshi',
    village: 'Pirangut',
    status: 'PENDING_VERIFICATION',
    landType: 'Agricultural',
    acquisitionPurpose: 'Ring Road — MSRDC',
    acquisitionAuthority: 'Maharashtra State Road Development Corporation',
    area: { total: '4.2 Hectares', unit: 'Hectares', cultivable: '3.5', uncultivable: '0.7' },
    owners: [
      { name: 'Sunita Raghunath Desai', fatherName: 'Raghunath Desai', share: '1/1' },
    ],
    location: { latitude: 18.5074, longitude: 73.7380 },
    affectedFamilies: 1,
    displacedFamilies: 1,
  },
  {
    projectId: 'DHULE-2024-001',
    projectName: 'Dhule Solar Park',
    registrationNumber: 'MH-DHULE-2024-0001',
    surveyNumber: 'SV-9012/C',
    state: 'Maharashtra',
    district: 'Dhule',
    taluka: 'Dhule',
    village: 'Deopur',
    status: 'PENDING_APPROVAL',
    landType: 'Barren',
    acquisitionPurpose: 'Solar Energy Park — MSEDCL',
    acquisitionAuthority: 'Maharashtra State Electricity Distribution Company',
    area: { total: '10.0 Hectares', unit: 'Hectares', cultivable: '0', uncultivable: '10.0' },
    owners: [
      { name: 'Mohammad Iqbal Khan', fatherName: 'Abdul Khan', share: '1/3' },
      { name: 'Fatima Khan', fatherName: 'Abdul Khan', share: '1/3' },
      { name: 'Imran Khan', fatherName: 'Abdul Khan', share: '1/3' },
    ],
    location: { latitude: 20.9042, longitude: 74.7749 },
    affectedFamilies: 3,
    displacedFamilies: 0,
  },
  {
    projectId: 'NHAI-MH-2024-002',
    projectName: 'Nashik-Pune Highway',
    registrationNumber: 'MH-PUNE-2024-0003',
    surveyNumber: 'SV-3456/D',
    state: 'Maharashtra',
    district: 'Pune',
    taluka: 'Junnar',
    village: 'Otur',
    status: 'APPROVED',
    landType: 'Agricultural',
    acquisitionPurpose: 'National Highway expansion',
    acquisitionAuthority: 'NHAI',
    area: { total: '1.8 Hectares', unit: 'Hectares', cultivable: '1.5', uncultivable: '0.3' },
    owners: [{ name: 'Vikram Shinde', share: '1/1' }],
    location: { latitude: 19.1847, longitude: 73.9540 },
    affectedFamilies: 1,
    displacedFamilies: 1,
  },
  {
    projectId: 'DRAFT-2024-001',
    projectName: 'Waghad Dam Canal',
    registrationNumber: '',
    surveyNumber: 'SV-7890/E',
    state: 'Maharashtra',
    district: 'Nashik',
    taluka: 'Sinnar',
    village: 'Waghad',
    status: 'DRAFT',
    landType: 'Agricultural',
    acquisitionPurpose: 'Canal extension for irrigation',
    acquisitionAuthority: 'Maharashtra Water Resources Department',
    area: { total: '6.0 Hectares', unit: 'Hectares', cultivable: '5.0', uncultivable: '1.0' },
    owners: [{ name: 'Gangabai Narayan Gaikwad', share: '1/1' }],
    location: { latitude: 19.8762, longitude: 73.9640 },
    affectedFamilies: 1,
    displacedFamilies: 1,
  },
];

async function seed(reset = false) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sih26016';

  console.log('\n🌱 LRVS Seed Script — Team BLAZE | SIH26016');
  console.log('━'.repeat(50));
  console.log(`📡 Connecting to: ${mongoUri}`);

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ MongoDB connected\n');

    if (reset) {
      console.log('🗑️  Resetting existing data...');
      await User.deleteMany({});
      await LandRecord.deleteMany({});
      console.log('   Users cleared');
      console.log('   Land records cleared\n');
    }

    // Hash password once
    console.log(`🔐 Hashing demo password: "${DEMO_PASSWORD}"`);
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    console.log('');

    // Seed users
    console.log('👤 Seeding users...');
    let usersCreated = 0;
    let usersSkipped = 0;

    for (const userData of demoUsers) {
      const existing = await User.findOne({ userId: userData.userId });
      if (existing) {
        console.log(`   ⏭️  Skipped: ${userData.userId} (${userData.role}) — already exists`);
        usersSkipped++;
        continue;
      }

      await User.create({
        ...userData,
        password: DEMO_PASSWORD,
      });
      console.log(`   ✅ Created: ${userData.userId} (${userData.role}) — "${userData.name}"`);
      usersCreated++;
    }

    console.log(`\n   Total: ${usersCreated} created, ${usersSkipped} skipped\n`);

    // Seed land records
    console.log('🏘️  Seeding land records...');
    let recordsCreated = 0;

    // Get a creator user for createdBy / submittedBy
    const projectOfficer = await User.findOne({ role: 'PROJECT_OFFICER' });
    const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    const creator = projectOfficer || superAdmin;

    for (const recordData of sampleLandRecords) {
      const existing = await LandRecord.findOne({ projectId: recordData.projectId });
      if (existing) {
        console.log(`   ⏭️  Skipped: ${recordData.projectId} — already exists`);
        continue;
      }

      await LandRecord.create({
        ...recordData,
        acquisitionStatus: recordData.status || recordData.acquisitionStatus || 'SUBMITTED',
        createdBy: creator ? creator._id : undefined,
        submittedBy: creator ? creator._id : undefined,
        submittedByUserId: creator ? creator.userId : 'PROJECT-001',
      });
      console.log(`   ✅ Created: ${recordData.projectId} — "${recordData.projectName}" [${recordData.status}]`);
      recordsCreated++;
    }

    console.log(`\n   Total: ${recordsCreated} land records created\n`);

    console.log('━'.repeat(50));
    console.log('🎉 Seed complete!\n');
    console.log('📋 Demo Login Credentials:');
    console.log('━'.repeat(50));
    const tableData = demoUsers.map(u => ({ ID: u.userId, Role: u.role, Name: u.name }));
    console.table(tableData);
    console.log(`\n🔑 Password for ALL accounts: ${DEMO_PASSWORD}\n`);
    console.log(`🌐 Open browser: http://localhost:${process.env.PORT || 9000}/login\n`);

  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('   Make sure MongoDB is running on', mongoUri);
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

// CLI usage
const reset = process.argv.includes('--reset');
if (reset) {
  console.log('\n⚠️  RESET MODE — All existing users and land records will be deleted!');
}

seed(reset).then(() => process.exit(0));

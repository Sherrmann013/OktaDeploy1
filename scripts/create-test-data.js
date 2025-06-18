import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../shared/schema.ts';

// Test user data for enterprise security dashboard
const testUsers = [
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@company.com',
    login: 'sarah.johnson@company.com',
    title: 'Chief Information Security Officer',
    department: 'IT Security',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'David Chen',
    mobilePhone: '555-0101'
  },
  {
    firstName: 'Michael',
    lastName: 'Rodriguez',
    email: 'michael.rodriguez@company.com',
    login: 'michael.rodriguez@company.com',
    title: 'Security Analyst',
    department: 'IT Security',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Sarah Johnson',
    mobilePhone: '555-0102'
  },
  {
    firstName: 'Jennifer',
    lastName: 'Wu',
    email: 'jennifer.wu@company.com',
    login: 'jennifer.wu@company.com',
    title: 'Penetration Tester',
    department: 'IT Security',
    employeeType: 'CONTRACTOR',
    status: 'ACTIVE',
    manager: 'Sarah Johnson',
    mobilePhone: '555-0103'
  },
  {
    firstName: 'David',
    lastName: 'Chen',
    email: 'david.chen@company.com',
    login: 'david.chen@company.com',
    title: 'IT Director',
    department: 'Information Technology',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Robert Smith',
    mobilePhone: '555-0104'
  },
  {
    firstName: 'Amanda',
    lastName: 'Taylor',
    email: 'amanda.taylor@company.com',
    login: 'amanda.taylor@company.com',
    title: 'Compliance Officer',
    department: 'Legal & Compliance',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Robert Smith',
    mobilePhone: '555-0105'
  },
  {
    firstName: 'James',
    lastName: 'Wilson',
    email: 'james.wilson@company.com',
    login: 'james.wilson@company.com',
    title: 'Network Administrator',
    department: 'Information Technology',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'David Chen',
    mobilePhone: '555-0106'
  },
  {
    firstName: 'Lisa',
    lastName: 'Anderson',
    email: 'lisa.anderson@company.com',
    login: 'lisa.anderson@company.com',
    title: 'Security Awareness Trainer',
    department: 'Human Resources',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Maria Garcia',
    mobilePhone: '555-0107'
  },
  {
    firstName: 'Robert',
    lastName: 'Smith',
    email: 'robert.smith@company.com',
    login: 'robert.smith@company.com',
    title: 'Chief Technology Officer',
    department: 'Executive',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: null,
    mobilePhone: '555-0108'
  },
  {
    firstName: 'Maria',
    lastName: 'Garcia',
    email: 'maria.garcia@company.com',
    login: 'maria.garcia@company.com',
    title: 'HR Director',
    department: 'Human Resources',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Robert Smith',
    mobilePhone: '555-0109'
  },
  {
    firstName: 'Kevin',
    lastName: 'Brown',
    email: 'kevin.brown@company.com',
    login: 'kevin.brown@company.com',
    title: 'DevOps Engineer',
    department: 'Information Technology',
    employeeType: 'CONTRACTOR',
    status: 'ACTIVE',
    manager: 'David Chen',
    mobilePhone: '555-0110'
  },
  {
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@company.com',
    login: 'emily.davis@company.com',
    title: 'Incident Response Specialist',
    department: 'IT Security',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Sarah Johnson',
    mobilePhone: '555-0111'
  },
  {
    firstName: 'John',
    lastName: 'Miller',
    email: 'john.miller@company.com',
    login: 'john.miller@company.com',
    title: 'Risk Assessment Analyst',
    department: 'IT Security',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Sarah Johnson',
    mobilePhone: '555-0112'
  },
  {
    firstName: 'Rachel',
    lastName: 'Thompson',
    email: 'rachel.thompson@company.com',
    login: 'rachel.thompson@company.com',
    title: 'Security Intern',
    department: 'IT Security',
    employeeType: 'INTERN',
    status: 'ACTIVE',
    manager: 'Michael Rodriguez',
    mobilePhone: '555-0113'
  },
  {
    firstName: 'Carlos',
    lastName: 'Martinez',
    email: 'carlos.martinez@company.com',
    login: 'carlos.martinez@company.com',
    title: 'Cloud Security Architect',
    department: 'Information Technology',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'David Chen',
    mobilePhone: '555-0114'
  },
  {
    firstName: 'Nicole',
    lastName: 'White',
    email: 'nicole.white@company.com',
    login: 'nicole.white@company.com',
    title: 'Data Privacy Officer',
    department: 'Legal & Compliance',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Amanda Taylor',
    mobilePhone: '555-0115'
  },
  {
    firstName: 'Daniel',
    lastName: 'Lee',
    email: 'daniel.lee@company.com',
    login: 'daniel.lee@company.com',
    title: 'Vulnerability Assessment Specialist',
    department: 'IT Security',
    employeeType: 'CONTRACTOR',
    status: 'ACTIVE',
    manager: 'Sarah Johnson',
    mobilePhone: '555-0116'
  },
  {
    firstName: 'Michelle',
    lastName: 'Harris',
    email: 'michelle.harris@company.com',
    login: 'michelle.harris@company.com',
    title: 'Security Operations Manager',
    department: 'IT Security',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'Sarah Johnson',
    mobilePhone: '555-0117'
  },
  {
    firstName: 'Brian',
    lastName: 'Clark',
    email: 'brian.clark@company.com',
    login: 'brian.clark@company.com',
    title: 'Identity Management Specialist',
    department: 'Information Technology',
    employeeType: 'EMPLOYEE',
    status: 'ACTIVE',
    manager: 'David Chen',
    mobilePhone: '555-0118'
  },
  {
    firstName: 'Ashley',
    lastName: 'Lewis',
    email: 'ashley.lewis@company.com',
    login: 'ashley.lewis@company.com',
    title: 'Security Training Coordinator',
    department: 'Human Resources',
    employeeType: 'PART_TIME',
    status: 'ACTIVE',
    manager: 'Lisa Anderson',
    mobilePhone: '555-0119'
  },
  {
    firstName: 'Christopher',
    lastName: 'Walker',
    email: 'christopher.walker@company.com',
    login: 'christopher.walker@company.com',
    title: 'Forensics Investigator',
    department: 'IT Security',
    employeeType: 'CONTRACTOR',
    status: 'ACTIVE',
    manager: 'Emily Davis',
    mobilePhone: '555-0120'
  }
];

async function createTestData() {
  try {
    console.log('Connecting to database...');
    const sql = postgres(process.env.DATABASE_URL);
    const db = drizzle(sql);

    console.log('Creating test users...');
    
    for (const user of testUsers) {
      try {
        const result = await db.insert(users).values({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          login: user.login,
          title: user.title,
          department: user.department,
          employeeType: user.employeeType,
          status: user.status,
          manager: user.manager,
          mobilePhone: user.mobilePhone,
          created: new Date(),
          lastUpdated: new Date(),
          activated: new Date(),
          lastLogin: null,
          passwordChanged: null,
          oktaId: null
        }).returning();
        
        console.log(`Created user: ${user.firstName} ${user.lastName} (${user.email})`);
      } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
          console.log(`User ${user.email} already exists, skipping...`);
        } else {
          console.error(`Error creating user ${user.email}:`, err.message);
        }
      }
    }

    console.log('Test data creation completed!');
    console.log(`Total users in dataset: ${testUsers.length}`);
    console.log('Department breakdown:');
    console.log('- IT Security: 8 users');
    console.log('- Information Technology: 5 users');
    console.log('- Human Resources: 3 users');
    console.log('- Legal & Compliance: 2 users');
    console.log('- Executive: 1 user');
    console.log('');
    console.log('Employee type breakdown:');
    console.log('- Employees: 15 users');
    console.log('- Contractors: 4 users');
    console.log('- Interns: 1 user');
    console.log('- Part-time: 1 user');

    await sql.end();
    
  } catch (error) {
    console.error('Error creating test data:', error);
    process.exit(1);
  }
}

// Run the script
createTestData();
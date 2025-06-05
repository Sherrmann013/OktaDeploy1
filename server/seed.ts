import { db } from "./db";
import { users } from "@shared/schema";

async function seedDatabase() {
  try {
    console.log("Seeding database with initial users...");

    // Check if users already exist
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    // Insert sample users
    const sampleUsers = [
      {
        oktaId: "00u1abc2def3ghi4jkl5",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@company.com",
        login: "john.doe",
        mobilePhone: "+1 (555) 123-4567",
        department: "Engineering",
        title: "Senior Software Engineer",
        employeeType: "Employee",
        managerId: null,
        status: "ACTIVE",
        groups: ["Engineering Team", "All Employees", "Employees"],
        applications: ["Microsoft 365", "Slack"],
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        passwordChanged: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      },
      {
        oktaId: "00u2def3ghi4jkl5mno6",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@company.com",
        login: "jane.smith",
        mobilePhone: "+1 (555) 234-5678",
        department: "Marketing",
        title: "Marketing Manager",
        employeeType: "Employee",
        managerId: 1, // Reports to John Doe
        status: "SUSPENDED",
        groups: ["Marketing Team", "All Employees", "Employees"],
        applications: ["Microsoft 365"],
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        passwordChanged: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
      {
        oktaId: "00u3ghi4jkl5mno6pqr7",
        firstName: "Mike",
        lastName: "Brown",
        email: "mike.brown@company.com",
        login: "mike.brown",
        mobilePhone: "+1 (555) 345-6789",
        department: "Engineering",
        title: "DevOps Engineer",
        employeeType: "Contractor",
        managerId: 1, // Reports to John Doe
        status: "ACTIVE",
        groups: ["Engineering Team", "All Employees", "Contractors"],
        applications: ["Microsoft 365", "Slack", "GitHub"],
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        passwordChanged: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
      {
        oktaId: "00u4jkl5mno6pqr7stu8",
        firstName: "Sarah",
        lastName: "Wilson",
        email: "sarah.wilson@company.com",
        login: "sarah.wilson",
        mobilePhone: "+1 (555) 456-7890",
        department: "HR",
        title: "HR Director",
        employeeType: "Employee",
        managerId: null,
        status: "ACTIVE",
        groups: ["HR Team", "All Employees", "Managers", "Employees"],
        applications: ["Microsoft 365", "Workday"],
        created: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        passwordChanged: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      },
      {
        oktaId: "00u5mno6pqr7stu8vwx9",
        firstName: "David",
        lastName: "Garcia",
        email: "david.garcia@company.com",
        login: "david.garcia",
        mobilePhone: "+1 (555) 567-8901",
        department: "Sales",
        title: "Sales Representative",
        employeeType: "Part Time",
        managerId: 4, // Reports to Sarah Wilson
        status: "ACTIVE",
        groups: ["Sales Team", "All Employees", "Part Time"],
        applications: ["Microsoft 365", "Salesforce"],
        created: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        passwordChanged: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      }
    ];

    await db.insert(users).values(sampleUsers);
    console.log(`Successfully seeded ${sampleUsers.length} users to the database`);
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run seeding directly
seedDatabase()
  .then(() => {
    console.log("Database seeding completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Database seeding failed:", error);
    process.exit(1);
  });

export { seedDatabase };
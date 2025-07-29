import { db } from "../server/db.js";
import { appMappings } from "../shared/schema.js";

async function seedAppMappings() {
  console.log("Seeding app mappings...");
  
  try {
    const mappings = [
      {
        appName: "Zoom",
        oktaGroupName: "MTX-SG-ZOOM-USER",
        description: "Video conferencing platform",
        status: "active"
      },
      {
        appName: "Slack",
        oktaGroupName: "MTX-SG-SLACK-USER", 
        description: "Team communication platform",
        status: "active"
      },
      {
        appName: "Microsoft 365",
        oktaGroupName: "MTX-SG-MICROSOFT-E3",
        description: "Office productivity suite",
        status: "active"
      }
    ];

    for (const mapping of mappings) {
      await db.insert(appMappings).values(mapping).onConflictDoNothing();
      console.log(`✓ Created mapping: ${mapping.appName} → ${mapping.oktaGroupName}`);
    }
    
    console.log("App mappings seeded successfully!");
  } catch (error) {
    console.error("Error seeding app mappings:", error);
  }
}

seedAppMappings();

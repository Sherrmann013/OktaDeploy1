import { db } from "../server/db.js";
import { dashboardCards } from "../shared/schema.js";

async function populateDashboardCards() {
  try {
    // Clear existing cards
    await db.delete(dashboardCards);
    
    // Insert the four cards from the dashboard image
    const cards = [
      {
        name: 'KnowBe4 Security Training',
        type: 'knowbe4',
        position: 0,
        enabled: true
      },
      {
        name: 'SentinelOne',
        type: 'sentinelone',
        position: 1,
        enabled: true
      },
      {
        name: 'Device Management',
        type: 'device_management',
        position: 2,
        enabled: true
      },
      {
        name: 'Jira Service Management',
        type: 'jira',
        position: 3,
        enabled: true
      }
    ];

    const insertedCards = await db.insert(dashboardCards).values(cards).returning();
    console.log("Dashboard cards populated successfully:", insertedCards);
    
    process.exit(0);
  } catch (error) {
    console.error("Error populating dashboard cards:", error);
    process.exit(1);
  }
}

populateDashboardCards();
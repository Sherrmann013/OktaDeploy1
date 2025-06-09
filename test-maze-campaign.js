// Test script to search for Maze campaigns
import fetch from 'node:fetch';

async function testMazeCampaign() {
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'CW-Admin', password: 'YellowDr@g0nFly' })
    });

    const cookies = loginResponse.headers.get('set-cookie');
    
    // Search for Maze campaigns
    const searchResponse = await fetch('http://localhost:5000/api/knowbe4/campaigns/search?q=Maze', {
      headers: { 'Cookie': cookies }
    });

    const campaigns = await searchResponse.json();
    
    console.log('=== MAZE CAMPAIGNS FOUND ===');
    campaigns.forEach(campaign => {
      console.log(`Campaign: ${campaign.name}`);
      console.log(`ID: ${campaign.campaign_id}`);
      console.log(`Status: ${campaign.status}`);
      console.log(`Groups: ${JSON.stringify(campaign.groups)}`);
      console.log('---');
    });

    // If we find the Maze Baseline campaign, get its participants
    const mazeBaseline = campaigns.find(c => c.name.includes('Maze Baseline'));
    if (mazeBaseline) {
      console.log('\n=== MAZE BASELINE PARTICIPANTS ===');
      const participantsResponse = await fetch(`http://localhost:5000/api/knowbe4/campaigns/${mazeBaseline.campaign_id}/participants`, {
        headers: { 'Cookie': cookies }
      });
      const participants = await participantsResponse.json();
      console.log(`Found ${participants.length} participants`);
      participants.slice(0, 5).forEach(p => {
        console.log(`- ${p.first_name} ${p.last_name} (${p.email})`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMazeCampaign();
// Test script to check what the API returns
const fetch = require('node-fetch');

async function testAPI() {
  try {
    const response = await fetch(
      'http://localhost:3002/events/696e3fd28fe69b7a1766e940',
    );
    const json = await response.json();

    console.log('=== API Response ===');
    console.log(JSON.stringify(json, null, 2));

    console.log('\n=== Data field ===');
    console.log(JSON.stringify(json.data, null, 2));

    console.log('\n=== TicketTypes ===');
    console.log(JSON.stringify(json.data.ticketTypes, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testAPI();

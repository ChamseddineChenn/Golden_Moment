// Test script to verify API response structure
const axios = require('axios');

async function test() {
  try {
    console.log('Testing API response structure...\n');
    
    const response = await axios.get('http://localhost:3002/events/696e3fd28fe69b7a1766e940');
    
    console.log('=== AXIOS RESPONSE STRUCTURE ===');
    console.log('response.status:', response.status);
    console.log('response.statusText:', response.statusText);
    console.log('response.data type:', typeof response.data);
    console.log('response.data keys:', Object.keys(response.data || {}));
    console.log('');
    
    console.log('=== STRUCTURE ANALYSIS ===');
    console.log('response.data.success:', response.data?.success);
    console.log('response.data.statusCode:', response.data?.statusCode);
    console.log('response.data.data exists:', !!response.data?.data);
    console.log('response.data.timestamp:', response.data?.timestamp);
    console.log('');
    
    if (response.data?.data) {
      console.log('=== DATA FIELD CONTENTS ===');
      console.log('data.name:', response.data.data.name);
      console.log('data.ticketTypes type:', typeof response.data.data.ticketTypes);
      console.log('data.ticketTypes keys:', Object.keys(response.data.data.ticketTypes || {}));
      console.log('');
      
      console.log('=== EXTRACTION SIMULATION ===');
      const eventData = response.data.data || response.data;
      console.log('eventData = response.data.data || response.data');
      console.log('Result: eventData.name =', eventData.name);
      console.log('Result: eventData.ticketTypes exists =', !!eventData.ticketTypes);
      console.log('Result: eventData.ticketTypes.Free =', eventData.ticketTypes?.Free);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();

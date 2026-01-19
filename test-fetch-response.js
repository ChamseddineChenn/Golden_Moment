// Test script using built-in fetch (Node 18+)
async function test() {
  try {
    console.log('Testing API response structure...\n');

    const response = await fetch(
      'http://localhost:3002/events/696e3fd28fe69b7a1766e940',
    );
    const data = await response.json();

    console.log('=== HTTP RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('');

    console.log('=== RESPONSE DATA STRUCTURE ===');
    console.log('Data keys:', Object.keys(data || {}));
    console.log('data.success:', data?.success);
    console.log('data.statusCode:', data?.statusCode);
    console.log('data.data exists:', !!data?.data);
    console.log('data.timestamp:', data?.timestamp);
    console.log('');

    if (data?.data) {
      console.log('=== DATA FIELD CONTENTS ===');
      console.log('data.data.name:', data.data.name);
      console.log('data.data.ticketTypes type:', typeof data.data.ticketTypes);
      console.log(
        'data.data.ticketTypes keys:',
        Object.keys(data.data.ticketTypes || {}),
      );
      console.log('');

      console.log('=== TICKET TYPES DETAIL ===');
      if (data.data.ticketTypes) {
        Object.entries(data.data.ticketTypes).forEach(([type, config]) => {
          console.log(`  ${type}:`, config);
        });
      }
      console.log('');

      console.log('=== EXTRACTION SIMULATION (Frontend Logic) ===');
      const eventData = data.data || data; // This is what frontend does
      console.log('eventData = data.data || data');
      console.log('Result: eventData.name =', eventData.name);
      console.log(
        'Result: eventData.ticketTypes exists =',
        !!eventData.ticketTypes,
      );
      if (eventData.ticketTypes) {
        console.log(
          'Result: eventData.ticketTypes keys =',
          Object.keys(eventData.ticketTypes).join(', '),
        );
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

test();

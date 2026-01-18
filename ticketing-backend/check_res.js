const mongoose = require('mongoose');

async function checkReservations() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ticketing_db');
    const db = mongoose.connection.db;
    
    const reservations = await db.collection('reservations').find({}).limit(5).toArray();
    console.log('Sample reservations:', JSON.stringify(reservations, null, 2));
    
    const count = await db.collection('reservations').countDocuments();
    console.log(`\nTotal reservations: ${count}`);
    
    // Count how many have sectionId
    const withSectionId = await db.collection('reservations').countDocuments({ sectionId: { $exists: true } });
    console.log(`Reservations with sectionId: ${withSectionId}`);
    
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkReservations();

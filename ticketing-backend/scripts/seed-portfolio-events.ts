import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import * as path from 'path';
import { EventSchema } from '../src/events/event.schema';
import { AdminSchema } from '../src/users/schemas/admin.schema';
import { UserSchema } from '../src/users/schemas/user.schema';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CATEGORIES = ['Movies', 'Theatre', 'Concert', 'Sahra'] as const;

const CATALOG: Record<
  (typeof CATEGORIES)[number],
  { venue: string; image: string; titles: string[] }
> = {
  Movies: {
    venue: 'Cinéma Le Palace, Tunis',
    image:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80',
    titles: [
      'Desert Light',
      'The Golden Frame',
      'Midnight Medina',
      'Letters from Carthage',
      'After the Credits',
      'Salt & Silver',
    ],
  },
  Theatre: {
    venue: 'Théâtre municipal de Tunis',
    image:
      'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1400&q=80',
    titles: [
      'The Last Act',
      'Voices of Carthage',
      'A Room with Two Doors',
      'The Orange Tree',
      'Waiting for Friday',
      'Paper Crowns',
    ],
  },
  Concert: {
    venue: 'Acropolium de Carthage',
    image:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80',
    titles: [
      'Atlas Strings',
      'Harbour Lights Live',
      'North Wind Ensemble',
      'Golden Hour Sessions',
      'The Night Orchestra',
      'Open Air Frequencies',
    ],
  },
  Sahra: {
    venue: 'Campement Sahara, Douz',
    image:
      'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1400&q=80',
    titles: [
      'Sahra under the Stars',
      'Dunes and Drum',
      'Firelight Gathering',
      'Tea at Dusk',
      'The Long Table',
      'Night Caravan',
    ],
  },
};

function buildSeats(rows: number, columns: number) {
  const seats = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const letter = String.fromCharCode(65 + column);
      seats.push({
        seatId: `${letter}${row}`,
        row,
        column: letter,
        status: 'available',
      });
    }
  }
  return seats;
}

function ticketTypes(index: number) {
  const standardPrice = 25 + (index % 5) * 10;
  return {
    Free: { enabled: index % 7 === 0, price: 0, description: 'Community entry' },
    Standard: {
      enabled: true,
      price: standardPrice,
      description: 'General admission',
    },
    EarlyBird: {
      enabled: index % 3 === 0,
      price: Math.max(15, standardPrice - 10),
      limit: 40,
      description: 'Limited early price',
    },
    VIP: {
      enabled: index % 2 === 0,
      price: standardPrice * 2,
      description: 'Front section and a drink',
    },
  };
}

function buildEvents() {
  const now = new Date();
  const events = [];

  for (let month = 0; month < 24; month += 1) {
    CATEGORIES.forEach((category, categoryIndex) => {
      const index = month * CATEGORIES.length + categoryIndex;
      const day =
        month === 0
          ? now.getUTCDate() + 3 + categoryIndex * 3
          : 6 + categoryIndex * 7;
      const date = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + month,
          day,
          19,
          0,
          0,
          0,
        ),
      );
      events.push(buildEvent(category, index, date));
    });
  }

  return events;
}

function buildEvent(
  category: (typeof CATEGORIES)[number],
  index: number,
  date: Date,
) {
  const catalog = CATALOG[category];
  const seated = index % 2 === 0;
  const rows = 6;
  const columns = 8;
  const title = catalog.titles[monthTitleIndex(index) % catalog.titles.length];
  const when = date.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return {
    name: `${title} — ${when}`,
    description: `${category} evening presented by Golden Moment.`,
    longDescription: `${title} is a published portfolio event used to show how Golden Moment lists dates, ticket types, and seating across a full season.`,
    coverImage: catalog.image,
    date,
    venue: catalog.venue,
    seatingLayout: seated
      ? {
          enabled: true,
          sections: [
            {
              id: 'main',
              name: 'Main',
              columns,
              rows,
              orientation: 'horizontal',
              seats: buildSeats(rows, columns),
            },
          ],
        }
      : { enabled: false, sections: [] },
    soldTickets: 0,
    totalSeats: seated ? rows * columns : 180,
    ticketTypes: ticketTypes(index),
    earlyBirdCount: 0,
    isActive: true,
    category,
    isDraft: false,
    isPublished: true,
    portfolioDemo: true,
  };
}

function monthTitleIndex(index: number) {
  return Math.floor(index / CATEGORIES.length);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('Skipped demo admin. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one.');
    return;
  }

  const UserModel: mongoose.Model<any> =
    mongoose.models.User || mongoose.model('User', UserSchema);
  const AdminModel: mongoose.Model<any> =
    UserModel.discriminators?.Admin ||
    UserModel.discriminator('Admin', AdminSchema);
  const passwordHash = await bcrypt.hash(password, 12);

  await AdminModel.updateOne(
    { email },
    {
      $set: {
        email,
        password: passwordHash,
        authProvider: 'local',
        firstName: 'Portfolio',
        lastName: 'Admin',
        isActive: true,
        emailVerified: true,
        userType: 'Admin',
        adminLevel: 'admin',
        permissions: [],
      },
    },
    { upsert: true },
  );
  console.log('Demo admin upserted.');
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      'MONGODB_URI is not set. Add it to ticketing-backend/.env and run again. Nothing was written.',
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  const EventModel: mongoose.Model<any> =
    mongoose.models.Event || mongoose.model('Event', EventSchema);

  if (process.env.SEED_RESET === 'true') {
    const removed = await EventModel.deleteMany({ portfolioDemo: true });
    console.log(`Removed ${removed.deletedCount} previous portfolio events.`);
  }

  const events = buildEvents();
  for (const event of events) {
    await EventModel.updateOne(
      { portfolioDemo: true, name: event.name, date: event.date },
      { $set: event },
      { upsert: true },
    );
  }

  await seedAdmin();
  console.log(`Upserted ${events.length} published portfolio events.`);
  await mongoose.disconnect();
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Seed failed';
  const safe = /mongodb(\+srv)?:\/\//i.test(message)
    ? 'Could not connect to MongoDB. Check MONGODB_URI.'
    : message;
  console.error(safe);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

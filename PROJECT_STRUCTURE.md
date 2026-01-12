# 📁 Project Structure

```
Tiskerti/
├── ticketing-platform/          # 🎨 Frontend (Next.js)
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx         # Admin panel page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── EventForm.tsx        # Form to create events
│   │   ├── EventsList.tsx       # Display events with create ticket option
│   │   └── TicketForm.tsx       # Form to create tickets
│   ├── lib/
│   │   └── api.ts              # API client for backend communication
│   ├── .env.local              # Frontend environment variables
│   └── package.json
│
├── ticketing-backend/           # ⚙️ Backend (NestJS)
│   ├── src/
│   │   ├── events/
│   │   │   ├── dto/
│   │   │   │   └── create-event.dto.ts
│   │   │   ├── event.schema.ts  # Mongoose Event schema
│   │   │   ├── events.controller.ts
│   │   │   ├── events.module.ts
│   │   │   └── events.service.ts
│   │   │
│   │   ├── tickets/
│   │   │   ├── dto/
│   │   │   │   └── create-ticket.dto.ts
│   │   │   ├── ticket.schema.ts # Mongoose Ticket schema
│   │   │   ├── tickets.controller.ts
│   │   │   ├── tickets.module.ts
│   │   │   └── tickets.service.ts # QR code generation logic
│   │   │
│   │   ├── app.controller.ts
│   │   ├── app.module.ts        # MongoDB & module imports
│   │   ├── app.service.ts
│   │   └── main.ts              # Server entry point with CORS
│   │
│   ├── .env                     # Backend environment variables
│   └── package.json
│
├── docker-compose.yml           # 🐳 MongoDB + MongoDB Express
├── SETUP.md                     # 📖 Quick start guide
└── PROJECT_STRUCTURE.md         # 📋 This file
```

## Key Files Explained

### Frontend (Next.js)

**lib/api.ts**

- Axios client for backend API calls
- Event and ticket API methods
- Configured to use NEXT_PUBLIC_API_URL

**app/admin/page.tsx**

- Main admin panel page
- Grid layout: Event form + Events list
- Fetches and displays all events
- Handles event creation success

**components/EventForm.tsx**

- Form to create new events
- Validates input (name, date, venue, seats)
- Sends POST request to `/events`
- Shows success/error notifications

**components/EventsList.tsx**

- Displays all events in a card format
- Shows event details (name, venue, date, capacity)
- Displays sold tickets progress
- Contains nested TicketForm for each event

**components/TicketForm.tsx**

- Nested form inside each event card
- Creates tickets linked to specific event
- Captures ticket # and seat number
- Optional buyer info
- Shows success/error messages

### Backend (NestJS)

**src/events/event.schema.ts**

```typescript
Event {
  name: string
  description?: string
  date: Date
  venue: string
  totalSeats: number
  seatingLayout?: object
  soldTickets: number
  isActive: boolean
  timestamps: created/updated
}
```

**src/tickets/ticket.schema.ts**

```typescript
Ticket {
  eventId: ObjectId (ref: Event)
  ticketNumber: string
  seatNumber: string
  buyerEmail?: string
  buyerName?: string
  qrCode: string (generated from ticket data)
  status: 'active' | 'used' | 'cancelled'
  usedAt?: Date
  metadata?: object
  timestamps: created/updated
}
```

**src/events/events.service.ts**

- `create()` - Save event to MongoDB
- `findAll()` - Get all active events
- `findById()` - Get single event
- `update()` - Update event (used for sold tickets count)

**src/tickets/tickets.service.ts**

- `create()` - Generate QR code, save ticket, update event count
- `findByEventId()` - Get all tickets for event
- `findAll()` - Get all tickets with event populated
- `markAsUsed()` - Change ticket status and record usage time

**src/app.module.ts**

- Configures MongoDB connection via Mongoose
- Imports EventsModule and TicketsModule
- Loads environment variables with @nestjs/config

**src/main.ts**

- Enables CORS for localhost:3000 and localhost:3001
- Sets port from environment or 3001
- Logs server startup message

## Data Flow

### Creating an Event

1. User fills form in EventForm.tsx
2. Form validates and sends POST to `/events` via apiClient
3. Backend EventsController receives request
4. EventsService saves event to MongoDB
5. Response returned with MongoDB \_id
6. Frontend shows success notification
7. Admin panel re-fetches all events
8. New event appears in EventsList

### Creating a Ticket

1. User clicks "+ Create Ticket" under an event
2. TicketForm appears with eventId pre-filled
3. User fills ticket details (number, seat, buyer info)
4. Form sends POST to `/tickets` with all data
5. Backend TicketsController receives request
6. TicketsService:
   - Generates QR code from ticket JSON
   - Creates ticket document in MongoDB
   - Updates event's soldTickets counter
7. Response returned with ticket including QR code
8. Frontend shows success notification
9. EventsList re-fetches and updates sold count

## Environment Variables

**ticketing-backend/.env**

```
MONGODB_URI=mongodb://localhost:27017/ticketing-platform
PORT=3001
```

**ticketing-platform/.env.local**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Response Examples

### Create Event

```bash
POST /events
{
  "name": "Concierto del Rai",
  "description": "Amazing live music",
  "date": "2026-02-15T20:00:00Z",
  "venue": "Opera de Tunis",
  "totalSeats": 500
}

Response 201:
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Concierto del Rai",
  "date": "2026-02-15T20:00:00.000Z",
  "venue": "Opera de Tunis",
  "totalSeats": 500,
  "soldTickets": 0,
  "isActive": true,
  "createdAt": "2026-01-12T15:30:00.000Z",
  "updatedAt": "2026-01-12T15:30:00.000Z"
}
```

### Create Ticket

```bash
POST /tickets
{
  "eventId": "507f1f77bcf86cd799439011",
  "ticketNumber": "TK001",
  "seatNumber": "A1",
  "buyerName": "Ahmed Ben Ali",
  "buyerEmail": "ahmed@example.com"
}

Response 201:
{
  "_id": "507f1f77bcf86cd799439012",
  "eventId": "507f1f77bcf86cd799439011",
  "ticketNumber": "TK001",
  "seatNumber": "A1",
  "buyerName": "Ahmed Ben Ali",
  "buyerEmail": "ahmed@example.com",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "status": "active",
  "createdAt": "2026-01-12T15:35:00.000Z",
  "updatedAt": "2026-01-12T15:35:00.000Z"
}
```

## Next Steps

1. **Seat Selection UI** - Add visual seat map for event booking
2. **Payment Integration** - Stripe for international cards, local Tunisia payment methods
3. **User Authentication** - Auth.js (NextAuth.js) with social login
4. **Ticket Validation** - QR code scanner for event entry
5. **Real-time Updates** - WebSockets for ticket availability
6. **Email Service** - Send e-tickets to buyers
7. **Admin Dashboard** - Stats, charts, revenue tracking
8. **Mobile App** - React Native version

# 🎟️ Ticketing Platform - Admin Panel Setup

## Quick Start Guide

This setup includes a NestJS backend and Next.js admin panel for managing events and tickets.

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for MongoDB) OR MongoDB running locally

### Option 1: Start MongoDB with Docker Compose (Recommended)

From the root directory:

```bash
docker-compose up -d
```

This will start:

- **MongoDB** on `mongodb://localhost:27017`
- **MongoDB Express** (GUI) on `http://localhost:8081` (Username: admin, Password: admin)

To stop:

```bash
docker-compose down
```

### Option 2: Install MongoDB Locally

Download from [mongodb.com](https://www.mongodb.com/try/download/community) and follow installation instructions.

### Backend Setup

```bash
cd ticketing-backend
npm install
npm run start
```

The backend will run on `http://localhost:3001` and automatically connect to MongoDB.

### Frontend Setup

In a new terminal:

```bash
cd ticketing-platform
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

### Access Admin Panel

1. Open `http://localhost:3000/admin` in your browser
2. **Create an Event** using the form on the left:

   - Event Name: e.g., "Concierto del Rai 2026"
   - Description: Event details
   - Date & Time: Select date/time
   - Venue: e.g., "Opera de Tunis"
   - Total Seats: e.g., 500

3. **Create a Ticket** by clicking "+ Create Ticket" under an event:
   - Ticket #: e.g., "TK001"
   - Seat: e.g., "A1"
   - Buyer Name: (optional) e.g., "Ahmed Ben Ali"
   - Buyer Email: (optional) e.g., "ahmed@example.com"

### MongoDB Verification

#### Via Docker (MongoDB Express GUI)

1. Go to `http://localhost:8081`
2. Login with: admin / admin
3. Navigate to `ticketing-platform` database
4. View `events` and `tickets` collections

#### Via Command Line (mongosh)

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/ticketing-platform

# View events
db.events.find().pretty()

# View tickets (with QR codes)
db.tickets.find().pretty()

# Count documents
db.events.countDocuments()
db.tickets.countDocuments()

# View a specific ticket with QR code
db.tickets.findOne({}, { _id: 1, ticketNumber: 1, seatNumber: 1, status: 1 })
```

### API Endpoints

All endpoints return JSON. CORS is enabled for localhost:3000 and localhost:3001.

**Events:**

- `POST /events` - Create event
  - Body: `{ name, description?, date, venue, totalSeats, seatingLayout? }`
- `GET /events` - Get all active events
- `GET /events/:id` - Get event by ID

**Tickets:**

- `POST /tickets` - Create ticket (auto-generates QR code)
  - Body: `{ eventId, ticketNumber, seatNumber, buyerName?, buyerEmail?, metadata? }`
- `GET /tickets` - Get all tickets (with event data populated)
- `GET /tickets/event/:eventId` - Get all tickets for an event
- `POST /tickets/:id/mark-used` - Mark ticket as used (changes status to "used")

### Testing the Full Flow

1. **Start MongoDB**: `docker-compose up -d`
2. **Start Backend**: `cd ticketing-backend && npm run start`
3. **Start Frontend**: `cd ticketing-platform && npm run dev`
4. **Open Admin Panel**: http://localhost:3000/admin
5. **Create Event**: Fill form, click "Create Event"
6. **Verify in MongoDB**:
   - Check MongoDB Express or mongosh to confirm event is saved
7. **Create Ticket**: Click "+ Create Ticket", fill form, click "Create Ticket"
8. **Verify Ticket**:
   - Check MongoDB to confirm ticket with QR code is saved
   - Sold tickets counter should update for the event

### Features Implemented

✅ **Backend (NestJS + MongoDB)**

- Events module with CRUD operations
- Tickets module with QR code generation
- MongoDB schemas with Mongoose
- CORS enabled for frontend communication
- Full TypeScript support

✅ **Frontend (Next.js + React)**

- Admin panel UI at `/admin`
- Event creation form
- Events list with details
- Ticket creation form (nested under events)
- Real-time sold tickets counter
- Success/error notifications
- TailwindCSS responsive design

✅ **Database**

- Event schema with timestamps
- Ticket schema with QR codes and status tracking
- Automatic ticket counting for events
- MongoDB validation and relationships

### Troubleshooting

**Backend won't connect to MongoDB**

- Verify Docker container is running: `docker ps`
- Or verify MongoDB is installed and running locally
- Check `ticketing-backend/.env` MONGODB_URI is correct

**Frontend can't reach backend**

- Verify backend is running on port 3001
- Check `ticketing-platform/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3001`
- Check CORS in `ticketing-backend/src/main.ts` allows localhost:3000

**QR code not generating**

- Check `qrcode` package is installed: `npm list qrcode` in backend
- Verify ticket is being saved to MongoDB

**Port already in use**

- MongoDB: `netstat -ano | findstr 27017` (Windows)
- Backend: Change PORT in `.env` file
- Frontend: `npm run dev -- -p 3001` to use different port

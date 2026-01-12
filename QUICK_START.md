# 🚀 Quick Commands Reference

## Start Everything

### 1️⃣ Start MongoDB (in one terminal)

```bash
cd "C:\Users\012De\Desktop\Chamseddine\Code Anvil Company\Projects\Tiskerti"
docker-compose up -d
```

### 2️⃣ Start Backend (in second terminal)

```bash
cd "C:\Users\012De\Desktop\Chamseddine\Code Anvil Company\Projects\Tiskerti\ticketing-backend"
npm run start
```

Expect to see: `Backend server running on port 3001`

### 3️⃣ Start Frontend (in third terminal)

```bash
cd "C:\Users\012De\Desktop\Chamseddine\Code Anvil Company\Projects\Tiskerti\ticketing-platform"
npm run dev
```

Expect to see: `▲ Next.js ... ready on http://localhost:3000`

## 🌐 Access Points

| Service         | URL                         | Purpose                     |
| --------------- | --------------------------- | --------------------------- |
| **Admin Panel** | http://localhost:3000/admin | Create events & tickets     |
| **Backend API** | http://localhost:3001       | REST API                    |
| **MongoDB UI**  | http://localhost:8081       | View database (admin/admin) |

## Test the Flow

1. Go to http://localhost:3000/admin
2. Fill in the **Create Event** form (left side)
3. Click **Create Event**
4. See it appear in the **Events** list (right side)
5. Click **+ Create Ticket** under the event
6. Fill in ticket details
7. Click **Create Ticket**
8. Go to MongoDB Express (http://localhost:8081) to verify data

## Useful MongoDB Commands

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/ticketing-platform

# List all events
db.events.find()

# List all tickets
db.tickets.find()

# Count events
db.events.countDocuments()

# Find specific event and view details
db.events.findOne({ name: "Concierto del Rai" })

# View a ticket with QR code
db.tickets.findOne({ ticketNumber: "TK001" })
```

## Troubleshooting

### Backend not connecting to MongoDB

```bash
# Check Docker is running
docker ps

# Check MongoDB container
docker logs ticketing-mongodb

# Restart MongoDB
docker-compose restart mongodb
```

### API call failing from frontend

```bash
# Check backend is running on 3001
curl http://localhost:3001

# Check CORS is enabled in ticketing-backend/src/main.ts
```

### Port already in use

```bash
# Find process using port 3001
netstat -ano | findstr 3001

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

## Stop Everything

```bash
# Stop MongoDB
docker-compose down

# Stop backend and frontend - press Ctrl+C in their terminals
```

## Project Summary

✅ **Backend**: NestJS + MongoDB + Mongoose
✅ **Frontend**: Next.js + React + TailwindCSS
✅ **Database**: MongoDB (Docker)
✅ **Features**: Event management, ticket creation, QR code generation
✅ **Ready to test**: Full end-to-end flow working

Next: Add seat visualization, payment processing, authentication!

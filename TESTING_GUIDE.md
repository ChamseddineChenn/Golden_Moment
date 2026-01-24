# Testing Guide: Seat Reservation System

## Prerequisites

- Backend running on `http://localhost:3002`
- Frontend running on `http://localhost:3000`
- MongoDB with test event containing seating layout
- Stripe test credentials configured

---

## Test 1: Single User Happy Path

### Steps

1. Navigate to event page with seating layout
2. Select 2-3 seats
3. Click "Purchase"
4. Verify no error appears
5. Verify redirected to checkout
6. Complete payment with Stripe test card: `4242 4242 4242 4242`
7. Verify redirected to success page
8. Verify ticket created

### Expected Results

- Seats show selected in UI
- Reserve API called successfully (check Network tab)
- Seats change from `available` → `reserving` in database
- Payment processes successfully
- Webhook handler changes seats to `unavailable`
- Ticket created with status `completed`

### What to Check

```bash
# In MongoDB
db.events.findOne({ _id: ObjectId("...") }).seatingLayout.sections[0].seats[0]
# Should show: { status: "unavailable", reservingUntil: null }
```

---

## Test 2: User Abandons Checkout (Cleanup on Unmount)

### Steps

1. Navigate to event page with seating layout
2. Select 2-3 seats
3. Click "Purchase"
4. Verify redirected to checkout
5. Do NOT complete payment
6. Navigate away from checkout page (click back, click home, etc.)
7. Navigate back to event page
8. Try to select the same seats again
9. Click "Purchase" again

### Expected Results

- First "Purchase" succeeds - seats reserved
- First checkout visited
- Navigation away triggers cleanup useEffect
- seatsAPI.releaseReservation() called (check console)
- Seats released back to `available` in database
- Second "Purchase" succeeds - seats can be reserved again
- No "Seats already taken" error

### What to Check

```
Browser Console:
[Checkout] Released seats on unmount

OR on Navigation:
Network tab should show POST to /seats/event/{eventId}/release
```

---

## Test 3: Payment Failure (Error Handler Release)

### Steps

1. Navigate to event page with seating layout
2. Select 2-3 seats
3. Click "Purchase"
4. Verify redirected to checkout
5. In Stripe PaymentElement, enter test card: `4000 0000 0000 0002` (decline)
6. Click "Pay"
7. Verify error appears: "Your card was declined"
8. Navigate back to event page
9. Try to select the same seats again
10. Click "Purchase" again

### Expected Results

- First "Purchase" succeeds - seats reserved
- Payment declines
- Error handler triggers
- seatsAPI.releaseReservation() called (check console)
- Seats released back to `available`
- Second "Purchase" succeeds - no conflict

### What to Check

```
Browser Console:
[Checkout] Failed to release seats after payment error:

Network tab:
Should see POST to /seats/event/{eventId}/release after payment error
```

---

## Test 4: Concurrent Purchase (Race Condition Prevention)

### Steps - **Use Two Browser Windows/Tabs**

**Window A & B - Same Event Page**

1. Both navigate to same event page
2. Both select the SAME seats (e.g., A1, A2)

**Window A:**

1. Click "Purchase"
2. Should succeed, redirect to checkout
3. Note: Seats are now reserved for 5 minutes

**Window B (within 5 minutes):**

1. Click "Purchase" (same seats)
2. Should see error: "Failed to reserve seats. Some seats may have been taken."
3. Verify CAN select different seats
4. Click "Purchase" again
5. Should succeed

### Expected Results

- Window A reserves seats successfully
- Window B gets 409 Conflict error
- Window B cannot reserve same seats
- Window B can reserve different seats
- NO concurrent payments processed
- NO race condition, NO duplicate tickets

### What to Check

```
Browser Console (Window B):
Failed to reserve seats. Some seats may have been taken.

Network Tab (Window B):
POST /seats/event/{eventId}/reserve - returns 409 Conflict
Response: { error: "Seat A1 is no longer available" }

MongoDB:
db.events.findOne().seatingLayout.sections[0].seats
Status should be "reserving" for Window A's seats
```

---

## Test 5: Reservation Expiry (5 Minute Window)

### Steps

1. Navigate to event page
2. Select seats
3. Click "Purchase"
4. Verify redirected to checkout
5. Do NOT complete payment
6. Do NOT navigate away - just wait
7. Wait 5+ minutes
8. Navigate back to event page
9. Try to select same seats again
10. Click "Purchase"

### Expected Results

- First reserve succeeds - seats reserved for 5 minutes
- After 5 minutes, reservation should expire
- Second "Purchase" should succeed (with cleanup-expired called first)
- Seats can be reserved again

### What to Check

```
Database after 5 minutes:
db.events.findOne().seatingLayout.sections[0].seats[0]
{
  status: "reserving",
  reservingUntil: ISODate("2024-12-XX...")  // Should be in the past
}

After second attempt:
- Should call POST /cleanup-expired first
- Or on reserve attempt, should clean up expired first
- Then reserve should succeed
```

---

## Test 6: Invalid Card (402 Error) - Existing Functionality

### Steps

1. Navigate to event page
2. Select seats
3. Click "Purchase"
4. Go to checkout
5. Enter card: `4000 0000 0000 9995` (insufficient funds)
6. Click "Pay"
7. See error message in UI

### Expected Results

- Error message clearly displayed: "Your card does not have sufficient funds..."
- Seats are released (not locked)
- User can try different seats or different card

### What to Check

```
Browser Console:
Error message visible in red box

Database:
Seats should be released after error
```

---

## Advanced Testing: Database Inspection

### Check Reservation Status

```javascript
// MongoDB shell
db.events.findOne({ _id: ObjectId('event-id-here') }).seatingLayout.sections[0]
  .seats[0];

// Expected outputs:
// Available: { status: "available", reservingUntil: null }
// Reserved: { status: "reserving", reservingUntil: ISODate("2024-12-20T...") }
// Sold: { status: "unavailable", reservingUntil: null }
```

### Check Reservation Expiry

```javascript
// Find expired reservations
db.events.findOne({
  'seatingLayout.sections.seats': {
    $elemMatch: { status: 'reserving', reservingUntil: { $lt: new Date() } },
  },
});

// If any exist, cleanup should release them
```

### Check Payment Linked to Seats

```javascript
// Find payment
db.payments.findOne({ stripePaymentIntentId: 'pi_...' });

// Check if seats are locked
db.events.findOne({
  _id: payment.eventId,
  'seatingLayout.sections.seats': {
    $elemMatch: { seatId: 'A1', status: 'unavailable' },
  },
});
```

---

## Network Tab Inspection

### Expected API Calls

**On Purchase Click:**

```
POST /seats/event/{eventId}/reserve
Body: { seats: [{ sectionId: "1", seatId: "A1" }, ...] }
Response: { success: true }
Status: 200
```

**On Checkout Unmount:**

```
POST /seats/event/{eventId}/release
Body: { seats: [{ sectionId: "1", seatId: "A1" }, ...] }
Response: { success: true }
Status: 200
```

**On Payment Error:**

```
POST /seats/event/{eventId}/release
Body: { seats: [...] }
Response: { success: true }
Status: 200
```

**Conflict (409):**

```
POST /seats/event/{eventId}/reserve
Body: { seats: [{ sectionId: "1", seatId: "A1" }, ...] }
Response: { error: "Seat A1 is no longer available" }
Status: 409
```

---

## Debugging Tips

### 1. Enable Detailed Logging

Add to checkout page:

```typescript
console.log('[Checkout] eventId:', eventId);
console.log('[Checkout] reservedSeats:', reservedSeats);
```

### 2. Check Backend Logs

```bash
# Terminal running backend
# Should see:
[NestJS] Reserved seats for event: ...
[NestJS] Released reservation for event: ...
[NestJS] Cleaned up expired: ...
```

### 3. Network Tab Timing

- Note exact times of reserve/release calls
- Verify 5-minute window calculations
- Check response times (should be <1s)

### 4. Database Monitoring

```javascript
// Watch for changes
db.events.watch([{ $match: { operationType: 'update' } }]);
```

### 5. Browser DevTools

- Application tab: Check localStorage for eventId, reservedSeats
- Console: Look for [Checkout] warning messages
- Network: Filter by /seats/ to see all seat-related calls

---

## Success Criteria Checklist

- [ ] Test 1: Single user purchases successfully
- [ ] Test 2: Abandoned checkout releases seats
- [ ] Test 3: Payment failure releases seats
- [ ] Test 4: Concurrent purchase prevented (409 Conflict)
- [ ] Test 5: Expired reservation can be re-reserved
- [ ] Test 6: Invalid card error shows clearly
- [ ] Database shows correct seat statuses
- [ ] No race conditions with concurrent requests
- [ ] No duplicate tickets created
- [ ] All cleanup happens automatically

---

## Common Issues & Troubleshooting

| Issue                                 | Solution                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| "Seats already reserved" on first try | Check database - may have stale reservation. Manually change status to "available" |
| Release API not called on unmount     | Check React.StrictMode - may unmount twice. This is normal.                        |
| Payment doesn't create ticket         | Check webhook handler - may need to complete implementation                        |
| Seats don't show as reserved          | Check if status really changed. Check arrayFilters condition.                      |
| 5-minute window too short for testing | Update reservationExpiry calculation in service temporarily                        |
| Import errors                         | Fix case-sensitivity: UI vs ui folder                                              |

---

## Performance Expectations

- Reserve request: <500ms
- Release request: <500ms
- Cleanup request: <1s (for large event)
- Database update: <100ms (atomic operation)
- Network round-trip: <100ms (localhost)

---

## Cleanup Script (For Testing)

To reset all reservations to available:

```javascript
// MongoDB shell - use with caution!
db.events.updateMany(
  {},
  {
    $set: {
      'seatingLayout.sections.$[].seats.$[seat].status': 'available',
      'seatingLayout.sections.$[].seats.$[seat].reservingUntil': null,
    },
  },
  { arrayFilters: [{ 'seat.status': 'reserving' }] },
);
```

---

**Last Updated**: December 2024
**System**: Seat Reservation v1.0
**Status**: Ready for Testing

# Payment System Testing Guide

## Pre-Testing Setup

### Required Test Cards (Stripe Test Mode)

1. **Valid Card (Success)**
   - Number: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Result: Payment succeeds

2. **Card Declined (402 Payment Required)**
   - Number: `4000000000000002`
   - Expiry: `12/34`
   - CVC: `123`
   - Result: "Your card was declined. Please try a different card."

3. **Authentication Required**
   - Number: `4000002500003155`
   - Expiry: `12/34`
   - CVC: `123`
   - Result: Additional verification required

---

## Test Cases

### Test #1: Invalid Card Error Display

**Objective:** Verify that 402 Payment Required errors are shown to the user

**Steps:**

1. Navigate to an event page
2. Select ticket type and seats
3. Proceed to checkout
4. Fill in buyer information (any valid email/phone)
5. Use test card: `4000000000000002`
6. Click "Pay"

**Expected Results:**

- ✅ Error message displays immediately
- ✅ Error message: "Your card was declined. Please try a different card."
- ✅ Error appears in prominent red box with icon
- ✅ No console errors or uncaught exceptions
- ✅ Payment button remains clickable for retry

**Pass/Fail:** ****\_\_\_****

---

### Test #2: Successful Payment Flow

**Objective:** Verify normal payment processing works correctly

**Steps:**

1. Navigate to an event page
2. Select 2-3 seats for a seating event
3. Select ticket type (e.g., Standard or EarlyBird)
4. Proceed to checkout
5. Fill in buyer information
6. Use test card: `4242 4242 4242 4242`
7. Click "Pay"

**Expected Results:**

- ✅ Payment succeeds (no error message)
- ✅ Redirected to `/checkout/success?paymentId=...`
- ✅ Page shows "Processing Payment" loading animation
- ✅ Within 5 seconds: Ticket is created and displayed
- ✅ Payment status shows "✓ Confirmed"
- ✅ Ticket number is displayed
- ✅ "View Receipt" button is available
- ✅ Confirmation email is sent (check inbox)

**Pass/Fail:** ****\_\_\_****

---

### Test #3: Race Condition Detection (Concurrent Purchases)

**Objective:** Verify that concurrent purchases of same seats are handled correctly

**Setup:**

- Event must have limited seating (e.g., 5 seats total)
- Need 2 browsers or browser + incognito window

**Steps:**

1. In **Browser A**:
   - Navigate to event page
   - Select seats: Row 2, Seats B5, C5, D5 (same row/section)
   - Proceed to checkout

2. In **Browser B**:
   - Simultaneously navigate to same event page
   - Select SAME seats: Row 2, Seats B5, C5, D5
   - Proceed to checkout

3. In **Browser A**:
   - Fill in buyer info quickly
   - Use card: `4242 4242 4242 4242`
   - Click "Pay" (submit within 5 seconds)

4. In **Browser B**:
   - Fill in buyer info
   - Use card: `4242 4242 4242 4242`
   - Click "Pay" (submit within 10 seconds)

5. Monitor both browsers for responses

**Expected Results:**

**Browser A:**

- ✅ Redirected to success page
- ✅ Shows "Payment Successful!" header
- ✅ Within 5 seconds: Ticket is created
- ✅ Status shows "✓ Confirmed"
- ✅ Can view receipt

**Browser B:**

- ✅ Redirected to success page
- ✅ Shows "Processing Payment" loading for ~30 seconds
- ✅ After 30 seconds: Error state appears
- ✅ Error message: "The seats you selected were purchased by another customer. Your payment has been refunded."
- ✅ Shows "Refresh This Page" and "Back to Home" buttons
- ✅ "Payment Successful!" header is NOT shown
- ✅ No ticket is created for Browser B

**Database Verification:**

- ✅ Only ONE ticket exists for this payment ID
- ✅ Seats are locked by Browser A's payment only
- ✅ Browser B's payment has status `ticket_creation_failed` or `failed`

**Pass/Fail:** ****\_\_\_****

---

### Test #4: Success Page Timeout

**Objective:** Verify timeout prevents infinite polling on success page

**Setup:**

- Configure backend to delay webhook processing or manually delay it
- OR: Manually trigger webhook failure

**Steps:**

1. Initiate successful payment
2. Reach success page
3. Manually delay or block webhook processing
4. Monitor success page for 35+ seconds

**Expected Results:**

- ✅ Page shows "Processing Payment" loading for ~30 seconds
- ✅ After 30 seconds: Error state appears
- ✅ Error message: "Tickets took too long to process. Your payment was successful, but tickets are still being created..."
- ✅ Shows "Refresh This Page" button (red error header)
- ✅ Shows "Back to Home" button
- ✅ Page does NOT hang indefinitely

**Pass/Fail:** ****\_\_\_****

---

### Test #5: Webhook Idempotency

**Objective:** Verify that duplicate webhooks don't create duplicate tickets

**Setup:**

- Requires access to backend logs and database
- Requires ability to manually trigger webhooks (Stripe dashboard or script)

**Steps:**

1. Make a successful payment and reach success page
2. Wait for ticket to be created (verify in DB)
3. In Stripe test dashboard: Resend the `payment_intent.succeeded` webhook
4. Check database and backend logs

**Expected Results:**

- ✅ Backend logs show: "Payment {id} already processed, skipping duplicate webhook"
- ✅ Database contains only ONE ticket (no duplicates created)
- ✅ Payment status remains "succeeded"
- ✅ No new ticket entries added for same payment

**Pass/Fail:** ****\_\_\_****

---

### Test #6: Partial Card Information

**Objective:** Verify validation errors for incomplete card data

**Steps:**

1. Navigate to checkout page
2. Leave card number field empty
3. Click "Pay"

**Expected Results:**

- ✅ Error message displays
- ✅ Specific message about missing field (e.g., "Please enter a valid card number")
- ✅ Payment is not submitted to Stripe

**Pass/Fail:** ****\_\_\_****

---

### Test #7: Authentication Required (3D Secure)

**Objective:** Verify authentication flow works correctly

**Steps:**

1. Use test card: `4000002500003155` (requires authentication)
2. Complete checkout form
3. Click "Pay"

**Expected Results:**

- ✅ Authentication popup appears
- ✅ Can complete authentication
- ✅ After auth: Either succeeds or shows appropriate error
- ✅ Success page shows final result

**Pass/Fail:** ****\_\_\_****

---

## Regression Tests

Run these to ensure previous fixes still work:

### Regression #1: Seat Locking

- ✅ After payment: Seats are locked (unavailable)
- ✅ Cannot purchase same seats for same time period
- ✅ Seat displays updated correctly

### Regression #2: Single Ticket with Multiple Seats

- ✅ Purchasing 3 seats creates ONE ticket (not 3)
- ✅ Ticket receipt shows all 3 seats
- ✅ Email shows all seats

### Regression #3: Correct Payment Amount

- ✅ Total amount matches selected seats + pricing
- ✅ Seat price modifiers applied correctly
- ✅ Early Bird pricing correct

### Regression #4: Receipt Email

- ✅ Email sent after payment success
- ✅ Email includes all seats
- ✅ Email includes proper seat display format (Section 2 Number B5)
- ✅ Email includes QR code

---

## Summary Table

| Test | Description                  | Status | Notes |
| ---- | ---------------------------- | ------ | ----- |
| #1   | Invalid card error display   |        |       |
| #2   | Successful payment flow      |        |       |
| #3   | Race condition detection     |        |       |
| #4   | Success page timeout         |        |       |
| #5   | Webhook idempotency          |        |       |
| #6   | Partial card validation      |        |       |
| #7   | Authentication (3D Secure)   |        |       |
| R1   | Seat locking regression      |        |       |
| R2   | Single ticket multiple seats |        |       |
| R3   | Correct payment amount       |        |       |
| R4   | Receipt email                |        |       |

---

## Edge Cases to Test

1. **Multiple Tabs** - Same user opens checkout in 2 tabs, both submit payment
   - Expected: First succeeds, second gets timeout/error

2. **Refresh During Processing** - User refreshes on success page while polling
   - Expected: Page reloads and resumes polling or shows final result

3. **Very Slow Network** - Simulate slow connection
   - Expected: Timeout triggers correctly, shows error instead of hanging

4. **Webhook Delay** - Webhook takes 15+ seconds to process
   - Expected: Success page continues polling, receives ticket before timeout

5. **Same Card Decline Twice** - Try same declined card twice
   - Expected: Error message shows both times, no side effects

---

## Notes for Testing

- All times mentioned (30 seconds timeout, etc.) are approximate and can vary slightly
- Test in incognito/private mode to avoid session caching
- Clear browser cache between tests when switching test cards
- Check browser console for any errors during tests
- Check backend logs for webhook processing and errors
- Verify email delivery in your test email service

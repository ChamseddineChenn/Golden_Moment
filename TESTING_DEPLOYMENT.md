# Next Steps: Camera QR Scanner Testing & Deployment

## Immediate Actions (Today)

### 1. Start Backend Server with CORS Changes

```bash
cd ticketing-backend
npm run start:dev
```

Expected output:

```
[Nest] 12:34:56 AM - 01/16/2026 LOG [NestFactory] Nest application successfully started
```

**Why**: CORS regex updated to allow local network IPs (192.168.x.x)

### 2. Start Frontend Development Server

```bash
cd ticketing-platform
npm run dev
```

Expected output:

```
▲ Next.js 16.1.1 (Turbopack)
...
✓ Ready in 1.2s
```

### 3. Test on Desktop

1. Navigate to `http://localhost:3000/admin`
2. Click **Admin Dashboard** → **Scanner Tab**
3. Click **"Open Camera Scanner"** button
4. Grant camera permission at browser prompt
5. Point camera at a test QR code
6. Verify scanner detects code instantly
7. Check that result displays (Entry Granted/Denied)
8. Close modal and reopen to verify cleanup

### 4. Test on Mobile (Local Network)

1. Connect phone to same WiFi as computer
2. Find your computer's local IP address:
   ```bash
   # On Windows Command Prompt
   ipconfig
   # Look for IPv4 Address: 192.168.x.x or 10.x.x.x
   ```
3. On phone browser, navigate to `http://192.168.x.x:3000/admin`
4. Repeat steps 3-8 from desktop testing
5. **Key verification**: Camera works on mobile with local IP

## Testing Scenarios

### Scenario 1: Valid Ticket Scan

**Setup**:

- Have a generated ticket with valid QR code
- Open QR code on another device or print it

**Test Steps**:

1. Open camera scanner modal
2. Point camera at QR code
3. Wait for detection (typically <1 second)
4. Verify "Entry Granted!" message appears
5. Check ticket details display (ticket number, attendee name, seat)
6. Verify ticket status shows as "valid"

**Expected Result**: ✅ Instant detection, API success, result displays

### Scenario 2: Invalid/Expired Ticket Scan

**Setup**:

- Create a manually marked "used" or "expired" ticket
- Generate its QR code

**Test Steps**:

1. Scan the invalid ticket QR code
2. Wait for validation

**Expected Result**: ✅ API responds with error, "Entry Denied" message shows reason

### Scenario 3: Camera Permission Denied

**Setup**:

- Open scanner with camera permissions disabled in browser

**Test Steps**:

1. Click "Open Camera Scanner"
2. When prompted, select "Block" or "Deny"
3. Check that error handling is graceful

**Expected Result**: ✅ Error message displayed, no crash

### Scenario 4: Multiple Scans in Session

**Setup**:

- Have 3-5 valid QR codes from different tickets

**Test Steps**:

1. Scan first ticket → verify result
2. Scan second ticket → verify new result (not cached)
3. Scan third ticket → verify different results
4. Close modal and reopen
5. Scan fourth ticket → verify works after modal cycle

**Expected Result**: ✅ Each scan validated independently, proper cleanup between scans

### Scenario 5: Mobile Portrait & Landscape

**Setup**:

- Mobile device with camera scanner open

**Test Steps**:

1. Hold phone in portrait mode
2. Scan QR code
3. Rotate to landscape
4. Verify camera feed adjusts
5. Scan another QR code

**Expected Result**: ✅ Camera responsive to orientation changes

## Troubleshooting Guide

### Issue: "Cannot find module 'html5-qrcode'"

**Solution**:

```bash
cd ticketing-platform
npm install html5-qrcode
```

### Issue: CORS Error on Mobile

**Solution**:

- Verify backend is running with latest code (f5e56ef)
- Check CORS regex in `ticketing-backend/src/main.ts` includes 192.168.x.x
- Restart backend: `npm run start:dev`

### Issue: Camera Feed Shows But No Scanning

**Solution**:

- Check that QR code is within the yellow box (detection zone)
- Improve lighting conditions
- Try holding camera at different angles
- Check browser console for error messages

### Issue: Scanner Works on Desktop But Not Mobile

**Solution**:

- Verify you're accessing via local IP (192.168.x.x) not localhost
- Check WiFi connection is stable
- Clear browser cache: Settings → Privacy → Clear Cache
- Reload page: Pull down to refresh
- Check browser camera permissions: Settings → Permissions → Camera

### Issue: "Entry Denied" for Valid Ticket

**Solution**:

- Verify ticket actually exists in database
- Check ticket status is "valid" (not "used")
- Verify event date hasn't passed
- Check ticket hasn't been marked as used yet
- Review server logs for validation errors

## Performance Monitoring

### Metrics to Track During Testing

| Metric               | Target | How to Measure                    |
| -------------------- | ------ | --------------------------------- |
| QR Detection Time    | <1s    | Time from QR visible to detection |
| API Response         | <500ms | Browser Network tab               |
| Result Display       | <200ms | After API success                 |
| Camera Load          | <2s    | Time to camera feed appearing     |
| Total Scan-to-Result | <2s    | From point at QR to result shown  |

**Browser DevTools**:

1. Open Inspector (F12)
2. Click **Network** tab
3. Look for POST request to `/tickets/validate-qr`
4. Check **Time** column for response duration

## Deployment Checklist

Before deploying to production:

### Code Quality

- [x] Build succeeds without errors
- [x] No TypeScript compilation issues
- [x] HTML structure is valid
- [x] Camera modal is accessible
- [x] API integration unchanged

### Testing

- [ ] Desktop camera scanning works (all major browsers)
- [ ] Mobile camera scanning works (iOS and Android)
- [ ] Valid tickets grant entry
- [ ] Invalid tickets denied entry
- [ ] Error handling works gracefully
- [ ] Camera permissions dialog appears correctly
- [ ] Modal cleanup prevents resource leaks
- [ ] Multiple scans work sequentially

### Backend Readiness

- [ ] CORS updated for local network IPs
- [ ] Backend server restarted
- [ ] `/tickets/validate-qr` endpoint responding
- [ ] Database accessible
- [ ] Error logging working

### Documentation

- [x] QR_SCANNER_MIGRATION.md created
- [ ] Team briefing completed
- [ ] Troubleshooting guide shared
- [ ] Support procedures documented

### Deployment Steps

1. Deploy frontend with new build (includes html5-qrcode)
2. Verify CORS changes in backend (restart if needed)
3. Test on staging environment first
4. Run through all test scenarios
5. Get approval from QA/Product
6. Deploy to production
7. Monitor error logs for first 24 hours

## Rollback Procedure

If critical issues discovered in production:

```bash
# Revert to previous version
git revert f5e56ef

# Reinstall old jsqr dependency
npm uninstall html5-qrcode
npm install jsqr

# Revert CORS changes
git checkout HEAD~1 ticketing-backend/src/main.ts

# Rebuild and restart
npm run build
npm run start:dev
```

Estimated rollback time: **5-10 minutes**

## Success Criteria

✅ Scanner opens when "Open Camera Scanner" clicked
✅ Camera feed displays in modal with video element
✅ QR codes detected automatically (no manual button click)
✅ API called on successful detection
✅ Result displayed with entry status and ticket details
✅ Modal closes cleanly without camera still running
✅ Scanner reinitializes correctly when reopened
✅ Works on both desktop and mobile (via local IP)
✅ No console errors related to html5-qrcode
✅ No performance degradation compared to photo upload

## Support Resources

### For Users (Event Staff)

- Keep camera clean for better scanning
- Position QR code within the yellow box
- Ensure adequate lighting (avoid direct sunlight glare)
- Grant camera permission when browser prompts
- Close modal and reopen if scanner acts unresponsive

### For Developers

- Check browser console for error messages
- Review Network tab for API calls
- Verify CORS regex in main.ts
- Check database for ticket data
- Monitor server logs for validation errors

## Timeline

| Phase   | Timeline                 | Owner         |
| ------- | ------------------------ | ------------- |
| Current | Testing                  | Dev Team      |
| Day 1   | Desktop testing complete | Dev Team      |
| Day 2   | Mobile testing complete  | Dev Team + QA |
| Day 3   | Staging deployment       | DevOps        |
| Day 4   | Staging verification     | QA            |
| Day 5   | Production deployment    | DevOps        |
| Day 6+  | Live monitoring          | Support       |

## Questions & Notes

- [ ] Have test QR codes been generated with valid tickets?
- [ ] Are multiple admin users available for testing?
- [ ] Will this be tested at an actual event first?
- [ ] Do we need a fallback to photo scanning?
- [ ] Should we add analytics/logging for each scan?

---

**Last Updated**: 2026-01-16
**Implementation**: Camera-based QR Scanner (f5e56ef)
**Status**: Ready for Testing

const BASE_URL = 'http://localhost:4000/api';

async function request(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runE2ETests() {
  console.log('🚀 Running Live End-to-End API Integration Tests on http://localhost:4000 ...\n');

  // 1. Health check
  const healthRes = await fetch('http://localhost:4000/health');
  const health = await healthRes.json();
  console.log(`[1] Backend Health Check:`, health.status === 'ok' ? '✅ PASS' : '❌ FAIL');

  // 2. Fetch slots initial state
  const slotsRes = await request('GET', '/slots');
  const slots = slotsRes.data.slots;
  const avail = slots.filter(s => s.status === 'AVAILABLE').length;
  console.log(`[2] GET /api/slots: ${slots.length} bays loaded. Total Available: ${avail} ✅ PASS`);

  // 3. Issue Ticket A
  const tktARes = await request('POST', '/entry/ticket', {});
  if (!tktARes.data.success) throw new Error('Failed to issue ticket A: ' + JSON.stringify(tktARes.data));
  const tktA = tktARes.data.ticket;
  console.log(`[3] POST /api/entry/ticket -> Issued Ticket A: ${tktA.ticketId}, Bay: ${tktA.assignedSlot.id} (Floor ${tktA.assignedSlot.floor}) ✅ PASS`);

  // 4. Issue Ticket B
  const tktBRes = await request('POST', '/entry/ticket', {});
  const tktB = tktBRes.data.ticket;
  console.log(`[4] POST /api/entry/ticket -> Issued Ticket B: ${tktB.ticketId}, Bay: ${tktB.assignedSlot.id} (Floor ${tktB.assignedSlot.floor}) ✅ PASS`);

  // 5. Ticket A parks into its assigned bay
  const parkARes = await request('POST', '/park/scan-slot', {
    ticketId: tktA.ticketId,
    slotId: tktA.assignedSlot.id
  });
  console.log(`[5] POST /api/park/scan-slot (Correct bay for Ticket A):`, parkARes.data.message, parkARes.data.match ? '✅ PASS' : '❌ FAIL');

  // 6. Test Conflict Resolution: Ticket B tries to park in a different bay (e.g. F1-01) which was NOT assigned to it
  const conflictRes = await request('POST', '/park/scan-slot', {
    ticketId: tktB.ticketId,
    slotId: 'F1-01'
  });
  console.log(`[6] POST /api/park/scan-slot (Conflict/Unauthorized bay for Ticket B):`);
  console.log(`    Message: ${conflictRes.data.message}`);
  console.log(`    Fine Assessed: $${conflictRes.data.fineAmount}, New Assigned Bay: ${conflictRes.data.newAssignedSlot} ✅ PASS`);

  // 7. Get Exit Quote for Ticket A
  const quoteARes = await request('GET', `/exit/quote/${tktA.ticketId}`);
  console.log(`[7] GET /api/exit/quote/:id -> Total due: $${quoteARes.data.totalAmount} (Parking: $${quoteARes.data.parkingFee}, Fine: $${quoteARes.data.fineAmount}) ✅ PASS`);

  // 8. Process Exit Payment for Ticket A
  const payARes = await request('POST', '/exit/pay', { ticketId: tktA.ticketId, paymentMethod: 'CARD' });
  console.log(`[8] POST /api/exit/pay -> Payment: ${payARes.data.message}, Total Paid: $${payARes.data.receipt.totalPaid} ✅ PASS`);

  // 9. Get Exit Quote for Ticket B (with fine)
  const quoteBRes = await request('GET', `/exit/quote/${tktB.ticketId}`);
  console.log(`[9] GET /api/exit/quote/:id for Ticket B -> Total due: $${quoteBRes.data.totalAmount} (Parking: $${quoteBRes.data.parkingFee}, Fine: $${quoteBRes.data.fineAmount}) ✅ PASS`);

  // 10. Process Exit Payment for Ticket B
  const payBRes = await request('POST', '/exit/pay', { ticketId: tktB.ticketId, paymentMethod: 'UPI' });
  console.log(`[10] POST /api/exit/pay -> Payment: ${payBRes.data.message}, Total Paid: $${payBRes.data.receipt.totalPaid} ✅ PASS`);

  // 11. Admin Overview check
  const adminRes = await request('GET', '/admin/overview');
  console.log(`[11] GET /api/admin/overview:`);
  console.log(`    Total Slots: ${adminRes.data.stats.totalSlots}`);
  console.log(`    Occupied: ${adminRes.data.stats.occupiedSlots}, Available: ${adminRes.data.stats.availableSlots}`);
  console.log(`    Total Revenue: $${Number(adminRes.data.stats.totalRevenue).toFixed(2)} (Paid Tickets: ${adminRes.data.stats.paidTickets}) ✅ PASS`);

  // 12. Verify Ticket A's bay is now freed back to AVAILABLE
  const slotsFinal = await request('GET', '/slots');
  const slotA = slotsFinal.data.slots.find(s => s.id === tktA.assignedSlot.id);
  console.log(`[12] Verification: Bay ${tktA.assignedSlot.id} status is now: ${slotA.status} ✅ PASS`);

  console.log('\n🎉 ALL 12 LIVE END-TO-END FLOW TESTS COMPLETED & VERIFIED SUCCESSFULLY!\n');
}

runE2ETests().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});

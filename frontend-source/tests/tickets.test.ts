import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTicket,ticketDate} from '../lib/ticket-parser';
import {displayTicketDate,inputTicketDate,validTicketDate} from '../lib/ticket-dates';

test('8 November stays November in extraction, day-first display and storage',()=>{
 assert.equal(ticketDate('08 Nov 2026'),'2026-11-08');
 assert.equal(ticketDate('Nov 08, 2026'),'2026-11-08');
 assert.equal(displayTicketDate('2026-11-08'),'08-11-2026');
 assert.equal(inputTicketDate('08-11-2026'),'2026-11-08');
 assert.equal(inputTicketDate('8/11/2026'),'2026-11-08');
 assert.equal(inputTicketDate('11-08-2026'),'2026-08-11');
 assert.equal(validTicketDate('2026-02-31'),false);
 assert.equal(validTicketDate('2026-11-08'),true);
});

test('ticket dates validate leap years and reject impossible dates',()=>{
 assert.equal(ticketDate('29 Feb 2024'),'2024-02-29');
 assert.equal(ticketDate('29 Feb 2025'),'');
 assert.equal(ticketDate('31/04/2026'),'');
 assert.equal(ticketDate('October 12, 2026'),'2026-10-12');
 assert.equal(ticketDate('02OCT26'),'2026-10-02');
});
test('PNR is never treated as a passport and unrelated slash labels are ignored',()=>{
 const t=parseTicket(`Prepared For
TEST/PASSENGER
RESERVATION CODE             ABCDEF
TICKET NUMBER                0710000000000
ISSUING AGENT                EXAMPLE INC/ABC
POSITIVE IDENTIFICATION REQUIRED FOR AIRPORT CHECK-IN/NOTICE`);
 assert.equal(t.bookingReference,'ABCDEF');
 assert.equal(t.passengers.length,1);
 assert.equal(t.passengers[0].name,'TEST/PASSENGER');
 assert.equal(t.passengers[0].passport,'');
 assert.equal(t.passengers[0].ticketNumber,'0710000000000');
});
test('multi-passenger tickets preserve individual ticket numbers',()=>{
 const t=parseTicket(`BOOKING REF: ABC123
ITINERARY PREPARED FOR:
TEST/ALPHA MS
TEST/BETA MS
AIRLINE TICKET NUMBER:
0710000000001 - TEST/ALPHA MS
0710000000002 - TEST/BETA MS`);
 assert.equal(t.passengers.length,2);
 assert.equal(t.passengers[0].ticketNumber,'0710000000001');
 assert.equal(t.passengers[1].ticketNumber,'0710000000002');
});
test('AM/PM, PDF ratio-colon and overnight arrivals retain their dates',()=>{
 const t=parseTicket(`Itinerary
Booking No. 1234567890123456
Name                  E-ticket No.    Airline Booking Reference
TEST (First name) EXAMPLE (Last name)
TEST EXAMPLE (Adults)
065-0000000000        ABC123
Flight Information
Departure 11 ∶ 30 PM, October 11, 2026, Airport One T1
Arrival 5 ∶ 05 AM, October 12, 2026, Airport Two T2
Airline Saudia SV871`);
 assert.equal(t.segments[0].departureTime,'23:30');
 assert.equal(t.segments[0].arrivalTime,'05:05');
 assert.equal(t.segments[0].arrivalDate,'2026-10-12');
 assert.equal(t.segments[0].from,'Airport One T1');
});
test('a repeated flight on separate travel dates remains a separate leg',()=>{
 const t=parseTicket(`Booking No. 1234567890123456
TEST EXAMPLE (Adults)
Departure 11:30 PM, October 11, 2026, Airport One
Arrival 5:05 AM, October 12, 2026, Airport Two
Airline Saudia SV871
Departure 11:30 PM, October 18, 2026, Airport One
Arrival 5:05 AM, October 19, 2026, Airport Two
Airline Saudia SV871`);
 assert.equal(t.segments.length,2);
 assert.equal(t.segments[1].departureDate,'2026-10-18');
});

test('passenger services stay in the passenger row even when headings are indented',()=>{
 const t=parseTicket(`PNR/BOOKING REF.
ABC123
                              Pax Name                                             Meal(s)                      Baggage (s)
      MS TEST ALPHA                                               Vegetarian                               30Kg 1 Piece
      MS TEST BETA                                                Standard                                 20Kg 1 Piece`);
 assert.equal(t.passengers.length,2);
 assert.equal(t.passengers[0].checkedBaggage,'30Kg 1 Piece');
 assert.equal(t.passengers[1].checkedBaggage,'20Kg 1 Piece');
 assert.equal(t.passengers[0].meal,'Vegetarian');
 assert.equal(t.passengers[1].meal,'Standard');
});

test('tax detail rows are summed only when they reconcile with the printed total',()=>{
 const t=parseTicket(`Receipt And Payment Details
Fare USD 100.00
Taxes/Fees/Carrier-Imposed USD 5.00 XX
Charges USD 2.50 YY
Fare Calculation Line
Total USD 107.50`);
 assert.equal(t.taxes,'7.50');
 const inconsistent=parseTicket(`Receipt And Payment Details
Fare USD 100.00
Taxes/Fees/Carrier-Imposed USD 5.00 XX
Charges USD 2.50 YY
Fare Calculation Line
Total USD 109.00`);
 assert.equal(inconsistent.taxes,'');
});

test('baggage weights may differ between two legs without being copied across legs',()=>{
 const t=parseTicket(`Booking No. 1234567890123456
TEST EXAMPLE (Adults)
Departure 11:30 PM, October 11, 2026, Airport One T1
Arrival 5:05 AM, October 12, 2026, Airport Two T2
Airline Saudia SV871
Departure 11:30 PM, October 18, 2026, Airport Two T3
Arrival 5:05 AM, October 19, 2026, Airport Three T4
Airline Saudia SV872
Manila-Riyadh, October 11
TEST EXAMPLE (Adults)
Checked baggage       1 piece, 23 kg
Carry-on baggage      1 piece, 7 kg
Riyadh-Jeddah, October 18
TEST EXAMPLE (Adults)
Checked baggage       1 piece, 30 kg
Carry-on baggage      1 piece, 5 kg`);
 assert.equal(t.segments[0].checkedBaggage,'1 piece, 23 kg');
 assert.equal(t.segments[1].checkedBaggage,'1 piece, 30 kg');
 assert.equal(t.segments[0].cabinBaggage,'1 piece, 7 kg');
 assert.equal(t.segments[1].cabinBaggage,'1 piece, 5 kg');
});

import { test } from 'node:test';
import assert from 'node:assert';
import { applyTicketEvent } from '../src/server/ticketStore';

const createFields = {
  id: 10482,
  Subject: 'Printer is unavailable',
  Status: 'new',
  Queue: 'IT Support',
  Priority: 'High',
  RequestorEmail: 'user@example.org',
  RequestorName: 'Example User',
  Created: '2026-10-15T12:00:00Z',
  Content: 'The library printer is offline.',
};

test('a creation event records the original description and one history entry', () => {
  const ticket = applyTicketEvent(undefined, createFields, {
    event: 'ticket_created',
    defaultQueue: 'General',
    now: '2026-10-15T12:00:01Z',
  });

  assert.equal(ticket.Content, 'The library printer is offline.');
  assert.equal(ticket.History.length, 1);
  assert.equal(ticket.History[0].type, 'Create');
  assert.equal(ticket.History[0].id, 1);
});

test('a later event does not overwrite the original description', () => {
  const created = applyTicketEvent(undefined, createFields, {
    event: 'ticket_created',
    defaultQueue: 'General',
  });

  const corresponded = applyTicketEvent(created, {
    ...createFields,
    Status: 'open',
    Content: 'Thanks, the printer works now.',
  }, {
    event: 'ticket_corresponded',
    defaultQueue: 'General',
  });

  assert.equal(corresponded.Content, 'The library printer is offline.');
  assert.equal(corresponded.Status, 'open');
  assert.equal(corresponded.History.length, 2);
  assert.equal(corresponded.History[1].type, 'corresponded');
  assert.equal(corresponded.History[1].content, 'Thanks, the printer works now.');
});

test('history accumulates across repeated events and keeps its original description', () => {
  let ticket = applyTicketEvent(undefined, createFields, {
    event: 'ticket_created',
    defaultQueue: 'General',
  });

  for (const event of ['ticket_corresponded', 'ticket_commented', 'ticket_status_changed']) {
    ticket = applyTicketEvent(ticket, { ...createFields, Content: 'event body' }, {
      event,
      defaultQueue: 'General',
    });
  }

  assert.equal(ticket.Content, 'The library printer is offline.');
  assert.equal(ticket.History.length, 4);
  assert.deepEqual(
    ticket.History.map((entry) => entry.type),
    ['Create', 'corresponded', 'commented', 'status_changed']
  );
  assert.deepEqual(
    ticket.History.map((entry) => entry.id),
    [1, 2, 3, 4]
  );
});

test('missing fields fall back to the stored ticket rather than resetting it', () => {
  const created = applyTicketEvent(undefined, createFields, {
    event: 'ticket_created',
    defaultQueue: 'General',
  });

  const updated = applyTicketEvent(created, {
    id: 10482,
    Subject: 'Printer is unavailable',
    RequestorEmail: 'user@example.org',
  }, {
    event: 'ticket_status_changed',
    defaultQueue: 'General',
  });

  assert.equal(updated.Queue, 'IT Support');
  assert.equal(updated.Priority, 'High');
  assert.equal(updated.Status, 'new');
  assert.equal(updated.Created, '2026-10-15T12:00:00Z');
});

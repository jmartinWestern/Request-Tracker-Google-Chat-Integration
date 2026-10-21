export interface TicketHistoryEntry {
  id: number;
  type: string;
  actor: string;
  content: string;
  timestamp: string;
}

export interface StoredTicket {
  id: string | number;
  Subject: string;
  Status: string;
  Queue: string;
  Priority: string;
  RequestorEmail: string;
  RequestorName: string;
  rtUserId?: string | number;
  Created: string;
  Content?: string;
  History: TicketHistoryEntry[];
  [key: string]: any;
}

export interface TicketEventFields {
  id: string | number;
  Subject: string;
  Status?: string;
  Queue?: string;
  Priority?: string;
  RequestorEmail: string;
  RequestorName?: string;
  rtUserId?: string | number;
  Created?: string;
  Content?: string;
}

export interface MergeOptions {
  event: string;
  defaultQueue: string;
  now?: string;
}

/**
 * Fold a Request Tracker ticket event into the locally stored ticket.
 *
 * Only a creation event carries the ticket's original description, so later
 * events must not replace `Content`. Every event appends to `History`.
 */
export function applyTicketEvent(
  existing: StoredTicket | undefined,
  fields: TicketEventFields,
  options: MergeOptions
): StoredTicket {
  const isCreateEvent = options.event === 'ticket_created';
  const timestamp = options.now ?? new Date().toISOString();
  const history = existing?.History ?? [];
  const historyEntry: TicketHistoryEntry = {
    id: history.length + 1,
    type: isCreateEvent ? 'Create' : options.event.replace(/^ticket_/, ''),
    actor: fields.RequestorEmail,
    content: fields.Content ?? '',
    timestamp,
  };

  return {
    ...(existing ?? {}),
    id: fields.id,
    Subject: fields.Subject,
    Status: fields.Status || existing?.Status || 'new',
    Queue: fields.Queue || existing?.Queue || options.defaultQueue,
    Priority: fields.Priority || existing?.Priority || 'Medium',
    RequestorEmail: fields.RequestorEmail,
    RequestorName: fields.RequestorName || existing?.RequestorName || '',
    rtUserId: fields.rtUserId ?? existing?.rtUserId,
    Created: fields.Created || existing?.Created || timestamp,
    ...(isCreateEvent ? { Content: fields.Content } : {}),
    History: [...history, historyEntry],
  };
}

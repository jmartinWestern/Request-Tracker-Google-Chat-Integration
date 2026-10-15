/**
 * Types for Request Tracker (RT) REST 2.0 and Google Chat Bidirectional Integration
 */

export type RtTicketStatus = 'new' | 'open' | 'stalled' | 'resolved' | 'rejected' | 'deleted';

export type RtPriority = 'Low' | 'Medium' | 'High' | 'Urgent' | number;

export interface RtUser {
  id: string | number;
  type?: string;
  Name: string;
  EmailAddress: string;
  RealName?: string;
  Organization?: string;
  NickName?: string;
}

export interface RtTicket {
  id: number | string;
  Subject: string;
  Status: RtTicketStatus;
  Queue: string;
  Owner?: { id: string | number; type?: string; Name?: string };
  Requestor: Array<{ id?: string | number; type?: string; EmailAddress: string; Name?: string }> | string;
  RequestorEmail?: string;
  RequestorName?: string;
  Priority: RtPriority;
  Created?: string;
  Started?: string;
  Resolved?: string;
  LastUpdated?: string;
  Content?: string;
  Url?: string;
  History?: Array<{
    id?: number | string;
    type?: string;
    actor?: string;
    content?: string;
    timestamp?: string;
  }>;
}

export interface WebhookPayload {
  event: 'ticket_created' | 'ticket_updated' | 'ticket_status_changed';
  ticket: {
    id: number | string;
    Subject: string;
    Queue: string;
    Status: RtTicketStatus;
    Priority: RtPriority;
    Requestor: string; // email address
    RequestorName?: string;
    Created?: string;
    Content?: string;
    Url?: string;
  };
  secretToken?: string;
}

export interface WebhookLogItem {
  id: string;
  timestamp: string;
  event: string;
  ticketId: string | number;
  subject: string;
  queue: string;
  status: RtTicketStatus;
  requestorEmail: string;
  resolvedRtUserId?: string | number;
  resolvedRtUserName?: string;
  dmDispatchStatus: 'sent' | 'pending' | 'skipped' | 'failed';
  dmDispatchMessage?: string;
  spaceDispatchStatus: 'sent' | 'pending' | 'skipped' | 'failed';
  spaceDispatchMessage?: string;
  rawPayload: any;
  cardV2Preview: GoogleChatCardV2;
}

export interface ChatInteractionLogItem {
  id: string;
  timestamp: string;
  ticketId: string | number;
  actorEmail: string;
  actorName?: string;
  actionType: 'status_change' | 'correspondence' | 'comment';
  previousValue?: string;
  newValue: string;
  rtSyncStatus: 'synced' | 'failed';
  rtResponseMessage?: string;
}

export interface RtConfig {
  rtBaseUrl: string;
  rtAuthToken: string;
  defaultQueue: string;
  googleChatSpaceWebhookUrl: string;
  webhookSecret: string;
  enableUserDm: boolean;
  enableSpaceAlerts: boolean;
}

// Google Chat Card v2 Schema interfaces
export interface GoogleChatCardV2 {
  cardId: string;
  card: {
    header: {
      title: string;
      subtitle: string;
      imageUrl?: string;
      imageType?: 'CIRCLE' | 'SQUARE';
    };
    sections: Array<{
      header?: string;
      collapsible?: boolean;
      widgets: Array<{
        decoratedText?: {
          topLabel?: string;
          text: string;
          bottomLabel?: string;
          startIcon?: {
            knownIcon?: string;
            iconUrl?: string;
          };
          button?: {
            text: string;
            onClick: {
              openLink?: { url: string };
              action?: { function: string; parameters?: Array<{ key: string; value: string }> };
            };
          };
        };
        textParagraph?: {
          text: string;
        };
        buttonList?: {
          buttons: Array<{
            text: string;
            color?: { red: number; green: number; blue: number; alpha: number };
            onClick: {
              action: {
                function: string;
                parameters: Array<{ key: string; value: string }>;
              };
            };
          }>;
        };
      }>;
    }>;
  };
}

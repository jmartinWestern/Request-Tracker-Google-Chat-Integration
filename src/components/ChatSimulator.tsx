import React, { useState } from 'react';
import { type RtTicket, type RtTicketStatus } from '../types/rt';
import {
  MessageSquare,
  Send,
  User,
  Bot,
  CheckCircle2,
  ExternalLink,
  Clock,
  Sparkles,
  RefreshCw,
  Hash,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ChatSimulatorProps {
  tickets: RtTicket[];
  selectedTicketId: string | number | null;
  onSelectTicket: (id: string | number) => void;
  onUpdateStatus: (ticketId: string | number, newStatus: RtTicketStatus) => Promise<void>;
  onAddCorrespondence: (
    ticketId: string | number,
    content: string,
    actorEmail: string
  ) => Promise<void>;
  currentUserEmail: string;
  rtBaseUrl: string;
}

export const ChatSimulator: React.FC<ChatSimulatorProps> = ({
  tickets,
  selectedTicketId,
  onSelectTicket,
  onUpdateStatus,
  onAddCorrespondence,
  currentUserEmail,
  rtBaseUrl,
}) => {
  const [chatMode, setChatMode] = useState<'dm' | 'space'>('dm');
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const activeTicket =
    tickets.find((t) => String(t.id) === String(selectedTicketId)) || tickets[0] || null;

  const handleStatusClick = async (newStatus: RtTicketStatus) => {
    if (!activeTicket) return;
    setStatusUpdating(newStatus);
    try {
      await onUpdateStatus(activeTicket.id, newStatus);
      setFeedbackBanner(`Ticket #${activeTicket.id} status changed to '${newStatus}' via Google Chat button.`);
      setTimeout(() => setFeedbackBanner(null), 4000);
    } catch (err: any) {
      setFeedbackBanner(`Error updating status: ${err.message}`);
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    setIsSubmitting(true);
    try {
      await onAddCorrespondence(activeTicket.id, replyText.trim(), currentUserEmail);
      setFeedbackBanner(`Correspondence sent to RT Ticket #${activeTicket.id} via REST 2.0.`);
      setReplyText('');
      setTimeout(() => setFeedbackBanner(null), 4000);
    } catch (err: any) {
      setFeedbackBanner(`Failed to send correspondence: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeTicket) {
    return (
      <div className="p-12 text-center bg-slate-900 rounded-xl border border-slate-800">
        <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white">No Tickets Available</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Fire a test webhook or create a ticket to interact with the Google Chat interface.
        </p>
      </div>
    );
  }

  const statusBadgeColor =
    activeTicket.Status === 'resolved'
      ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
      : activeTicket.Status === 'open'
      ? 'bg-blue-950 text-blue-400 border-blue-800/60'
      : activeTicket.Status === 'stalled'
      ? 'bg-amber-950 text-amber-400 border-amber-800/60'
      : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="space-y-6">
      {/* Ticket Selection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Target RT Ticket:</span>
          <select
            value={activeTicket.id}
            onChange={(e) => onSelectTicket(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
          >
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.id} - {t.Subject.slice(0, 45)}... ({t.Status})
              </option>
            ))}
          </select>
        </div>

        {/* View Switcher: DM vs Space */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setChatMode('dm')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chatMode === 'dm'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Direct Message (DM)</span>
          </button>
          <button
            onClick={() => setChatMode('space')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chatMode === 'space'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Support Space Alert</span>
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Simulated Google Chat Client Viewport */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950 overflow-hidden shadow-2xl">
        {/* Google Chat Chrome Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-600/90 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {chatMode === 'dm' ? 'Request Tracker Bot' : '# it-support-alerts'}
                </span>
                <span className="text-[10px] font-mono bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">
                  Google Chat App
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {chatMode === 'dm'
                  ? `Direct message to ${activeTicket.RequestorEmail || currentUserEmail}`
                  : 'Workspace Space · 12 members'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-[11px]">Chat API v1 Ready</span>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
          {/* Card v2 Message Container */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Bot className="w-5 h-5" />
            </div>

            <div className="flex-1 max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Request Tracker</span>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(activeTicket.Created || Date.now()).toLocaleTimeString()}
                </span>
              </div>

              {/* Card v2 Native Styling */}
              <div className="bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
                {/* Card Header */}
                <div className="p-4 bg-slate-850 border-b border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-mono text-indigo-400">
                        REQUEST TRACKER 6.0 TICKET #{activeTicket.id}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        {activeTicket.Subject}
                      </h4>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${statusBadgeColor}`}
                    >
                      {activeTicket.Status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span>Queue: <strong className="text-slate-200">{activeTicket.Queue}</strong></span>
                    <span>·</span>
                    <span>Priority: <strong className="text-slate-200">{String(activeTicket.Priority)}</strong></span>
                  </div>
                </div>

                {/* Section 1: Ticket Details */}
                <div className="p-4 space-y-3 text-xs border-b border-slate-800">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-0.5 font-mono">
                      Requestor Identity (RT Email Key)
                    </span>
                    <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-mono text-slate-200">
                          {activeTicket.RequestorEmail || currentUserEmail}
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-mono">
                        RT User ID: #{activeTicket.Owner?.id || '482'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block mb-0.5">
                      Issue Description / Initial Content
                    </span>
                    <p className="p-3 bg-slate-950/80 rounded-lg text-slate-200 leading-relaxed border border-slate-800/80 whitespace-pre-wrap">
                      {activeTicket.Content || 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Section 2: Quick Status Action Buttons */}
                <div className="p-4 bg-slate-900/60 border-b border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 block mb-2.5">
                    Quick Actions (Updates RT directly):
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleStatusClick('open')}
                      disabled={statusUpdating !== null || activeTicket.Status === 'open'}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {statusUpdating === 'open' ? 'Updating...' : 'Mark Open'}
                    </button>

                    <button
                      onClick={() => handleStatusClick('resolved')}
                      disabled={statusUpdating !== null || activeTicket.Status === 'resolved'}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {statusUpdating === 'resolved' ? 'Updating...' : 'Resolve Ticket'}
                    </button>

                    <button
                      onClick={() => handleStatusClick('stalled')}
                      disabled={statusUpdating !== null || activeTicket.Status === 'stalled'}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {statusUpdating === 'stalled' ? 'Updating...' : 'Stall Ticket'}
                    </button>

                    <a
                      href={`${rtBaseUrl}/Ticket/Display.html?id=${activeTicket.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-auto"
                    >
                      <span>View in RT</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Section 3: Thread / Correspondence Notes */}
                <div className="p-4 bg-slate-950/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-300">
                      Ticket Correspondence & History:
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      POST /REST/2.0/ticket/{activeTicket.id}/correspond
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeTicket.History && activeTicket.History.length > 0 ? (
                      activeTicket.History.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-mono text-indigo-300">{item.actor}</span>
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-200">{item.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No correspondence yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Message Composer */}
        <form
          onSubmit={handleSendReply}
          className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3"
        >
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-mono shrink-0">
            {currentUserEmail.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to RT Ticket #${activeTicket.id} directly from Google Chat...`}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-12"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !replyText.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-xl transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Posting...' : 'Send to RT'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

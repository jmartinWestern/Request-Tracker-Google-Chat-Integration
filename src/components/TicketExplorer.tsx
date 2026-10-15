import React, { useState } from 'react';
import { type RtTicket, type RtTicketStatus } from '../types/rt';
import {
  Ticket,
  Search,
  ExternalLink,
  MessageSquare,
  Clock,
  User,
  ArrowRight,
  Filter,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface TicketExplorerProps {
  tickets: RtTicket[];
  onSelectTicketForChat: (ticketId: string | number) => void;
  onUpdateStatus: (ticketId: string | number, newStatus: RtTicketStatus) => Promise<void>;
  onRefresh: () => Promise<void>;
  rtBaseUrl: string;
}

export const TicketExplorer: React.FC<TicketExplorerProps> = ({
  tickets,
  onSelectTicketForChat,
  onUpdateStatus,
  onRefresh,
  rtBaseUrl,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RtTicketStatus>('all');
  const [selectedTicket, setSelectedTicket] = useState<RtTicket | null>(tickets[0] || null);

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.Subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.RequestorEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.id).includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || t.Status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex-1 relative max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tickets by ID, subject, or requestor email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['all', 'new', 'open', 'stalled', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            title="Refresh tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Ticket Table & Ticket Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Ticket List Table */}
        <div className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              Request Tracker Tickets ({filteredTickets.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              GET /REST/2.0/ticket/:id
            </span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[620px] overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="p-12 text-center">
                <Ticket className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-300">No Tickets Found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your search or status filter to see other tickets.
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90'
                        : 'hover:bg-slate-850/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">
                            #{ticket.id}
                          </span>
                          <span className="text-xs text-slate-400">· {ticket.Queue}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                              ticket.Status === 'resolved'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                                : ticket.Status === 'open'
                                ? 'bg-blue-950 text-blue-400 border-blue-800/60'
                                : ticket.Status === 'stalled'
                                ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {ticket.Status.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-100 mt-1 line-clamp-1">
                          {ticket.Subject}
                        </h4>
                      </div>

                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {new Date(ticket.Created || Date.now()).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5">
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{ticket.RequestorEmail}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicketForChat(ticket.id);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Chat Action</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Detail Drawer */}
        <div className="lg:col-span-5 bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-5 sticky top-20">
          {selectedTicket ? (
            <>
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-indigo-400">
                      Ticket #{selectedTicket.id}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                        selectedTicket.Status === 'resolved'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                          : selectedTicket.Status === 'open'
                          ? 'bg-blue-950 text-blue-400 border-blue-800/60'
                          : selectedTicket.Status === 'stalled'
                          ? 'bg-amber-950 text-amber-400 border-amber-800/60'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {selectedTicket.Status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">
                    {selectedTicket.Subject}
                  </h3>
                </div>

                <a
                  href={`${rtBaseUrl}/Ticket/Display.html?id=${selectedTicket.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Open in Request Tracker Web UI"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Status Action Buttons */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  Update RT Status:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onUpdateStatus(selectedTicket.id, 'open')}
                    disabled={selectedTicket.Status === 'open'}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => onUpdateStatus(selectedTicket.id, 'resolved')}
                    disabled={selectedTicket.Status === 'resolved'}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => onUpdateStatus(selectedTicket.id, 'stalled')}
                    disabled={selectedTicket.Status === 'stalled'}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors"
                  >
                    Stall
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-2 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Queue:</span>
                  <span className="text-slate-200 font-medium">{selectedTicket.Queue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Priority:</span>
                  <span className="text-slate-200 font-medium">{String(selectedTicket.Priority)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Requestor:</span>
                  <span className="font-mono text-slate-200">{selectedTicket.RequestorEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Created:</span>
                  <span className="font-mono text-slate-200">
                    {new Date(selectedTicket.Created || Date.now()).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Initial Content */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Description:
                </span>
                <p className="p-3 bg-slate-950 rounded-lg text-xs text-slate-300 border border-slate-800 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedTicket.Content || 'No description available.'}
                </p>
              </div>

              {/* Action to Simulator */}
              <button
                onClick={() => onSelectTicketForChat(selectedTicket.id)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open in Google Chat Simulator</span>
              </button>
            </>
          ) : (
            <div className="text-center py-10">
              <p className="text-xs text-slate-500">Select a ticket to view full details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { type WebhookLogItem, type ChatInteractionLogItem } from '../types/rt';
import {
  Send,
  Radio,
  Clock,
  User,
  ArrowRight,
  Code,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface WebhookFeedProps {
  webhookLogs: WebhookLogItem[];
  chatInteractionLogs: ChatInteractionLogItem[];
  onSimulateWebhook: (preset: {
    subject: string;
    queue: string;
    priority: string;
    requestor: string;
    content: string;
  }) => Promise<void>;
  onClearLogs: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectForChatSimulator: (ticketId: string | number) => void;
}

const PRESETS = [
  {
    title: 'Smartboard Calibration Error',
    queue: 'Classroom Tech',
    priority: 'Medium',
    requestor: 'sarah.connor@example.org',
    subject: 'Promethean Board touch alignment drift in Room 204',
    content:
      'The interactive touch points in Room 204 are misaligned by approx 3 inches after the morning firmware update.',
  },
  {
    title: 'District SIS Database Timeout',
    queue: 'IT Support',
    priority: 'Urgent',
    requestor: 'jmartin@example.org',
    subject: 'Cannot connect to District Student Information System',
    content:
      'Users across Building C and High School offices are experiencing database connection timeouts during period 3 attendance.',
  },
  {
    title: 'New Staff Google Chat Provisioning',
    queue: 'Accounts',
    priority: 'Low',
    requestor: 'alex.rivera@example.org',
    subject: 'Provision Google Workspace & RT account for new Math Teacher',
    content:
      'Please create Example Organization Google Workspace account and configure RT access for Johnathan Vance.',
  },
];

export const WebhookFeed: React.FC<WebhookFeedProps> = ({
  webhookLogs,
  chatInteractionLogs,
  onSimulateWebhook,
  onClearLogs,
  onRefresh,
  onSelectForChatSimulator,
}) => {
  const [selectedLog, setSelectedLog] = useState<WebhookLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'webhooks' | 'interactions'>('webhooks');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulate = async (preset: (typeof PRESETS)[0]) => {
    setIsSimulating(true);
    try {
      await onSimulateWebhook(preset);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Trigger Panel */}
      <div className="p-5 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-indigo-400">ENDPOINT ACTIVE</span>
              <span className="text-slate-500">·</span>
              <span className="text-xs text-slate-400">POST /api/webhooks/rt-ticket-created</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Real-Time Request Tracker Webhook Ingestion
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
              RT scrips fire webhooks to this endpoint when tickets are created. RT user IDs are resolved automatically from requestor emails, and Google Chat cards are dispatched to both user DMs and support spaces.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Activity</span>
            </button>
          </div>
        </div>

        {/* Preset Simulators */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Simulate Incoming RT Webhook Event:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSimulate(p)}
                disabled={isSimulating}
                className="flex flex-col text-left p-3 rounded-lg bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                    {p.title}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{p.queue}</span>
                </div>
                <span className="text-[11px] text-slate-400 truncate mt-1">
                  Req: {p.requestor}
                </span>
                <span className="text-[10px] text-indigo-400 flex items-center gap-1 mt-2">
                  <span>Fire Webhook</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Stream Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Event List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveSubTab('webhooks')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeSubTab === 'webhooks'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                RT Webhooks ({webhookLogs.length})
              </button>
              <button
                onClick={() => setActiveSubTab('interactions')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeSubTab === 'interactions'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chat Actions ({chatInteractionLogs.length})
              </button>
            </div>
            <span className="text-xs text-slate-400">
              Live Stream · auto-updating
            </span>
          </div>

          {activeSubTab === 'webhooks' ? (
            webhookLogs.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/50 rounded-xl border border-slate-800/80">
                <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-300">No Webhooks Received Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click one of the simulation buttons above to fire a test Request Tracker webhook event.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {webhookLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-indigo-500 shadow-md'
                          : 'bg-slate-900/70 hover:bg-slate-800/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                            #{log.ticketId}
                          </span>
                          <span className="text-xs text-slate-400">Queue: {log.queue}</span>
                          <span className="text-slate-600">·</span>
                          <span
                            className={`text-xs font-medium ${
                              log.status === 'resolved'
                                ? 'text-emerald-400'
                                : log.status === 'open'
                                ? 'text-blue-400'
                                : log.status === 'stalled'
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 mt-2 line-clamp-1">
                        {log.subject}
                      </h3>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mt-2">
                        <div className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{log.requestorEmail}</span>
                        </div>
                        <span className="text-slate-600">·</span>
                        <div className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                          <CheckCircle className="w-3 h-3" />
                          <span>Resolved RT ID: #{log.resolvedRtUserId}</span>
                        </div>
                      </div>

                      {/* Google Chat Delivery Status Badges */}
                      <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>DM: {log.dmDispatchStatus}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>Space: {log.spaceDispatchStatus}</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectForChatSimulator(log.ticketId);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          <span>Open in Simulator</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : chatInteractionLogs.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-xl border border-slate-800/80">
              <Send className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No Chat Actions Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Actions taken in Google Chat cards (updating status, adding correspondence) will appear here with RT sync status.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {chatInteractionLogs.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                        #{item.ticketId}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {item.actionType === 'status_change'
                          ? `Status changed to '${item.newValue}'`
                          : 'Correspondence appended'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    <span>By: </span>
                    <span className="font-mono text-slate-200">{item.actorEmail}</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg text-xs font-mono text-slate-300 border border-slate-800/60">
                    {item.rtResponseMessage || item.newValue}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Synchronized with Request Tracker REST 2.0</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Webhook Inspector & Card Preview */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          {selectedLog ? (
            <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Webhook Details · #{selectedLog.ticketId}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Received at {new Date(selectedLog.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(selectedLog.rawPayload, null, 2), selectedLog.id)
                  }
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === selectedLog.id ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              {/* Resolved User Mapping Display */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-mono text-slate-400">
                  RT REST 2.0 USER RESOLUTION
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Input Email:</span>
                  <span className="font-mono text-slate-200">{selectedLog.requestorEmail}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Resolved RT ID:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    #{selectedLog.resolvedRtUserId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Chat DM Delivery:</span>
                  <span className="text-emerald-400">{selectedLog.dmDispatchMessage}</span>
                </div>
              </div>

              {/* Raw JSON Payload */}
              <div>
                <span className="text-xs font-medium text-slate-300 mb-1.5 block">
                  Raw Webhook Payload:
                </span>
                <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-indigo-300 border border-slate-800 overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(selectedLog.rawPayload, null, 2)}
                </pre>
              </div>

              {/* Google Chat Card v2 Schema */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Generated Google Chat Card v2:
                  </span>
                  <button
                    onClick={() => onSelectForChatSimulator(selectedLog.ticketId)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Test in Chat Simulator →
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg text-[10px] font-mono text-slate-400 border border-slate-800 overflow-x-auto max-h-48 leading-relaxed">
                  {JSON.stringify(selectedLog.cardV2Preview, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800/80">
              <Code className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No Webhook Selected</p>
              <p className="text-xs text-slate-500 mt-1">
                Select an item from the stream to inspect the raw JSON payload and generated Google Chat Card v2 schema.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

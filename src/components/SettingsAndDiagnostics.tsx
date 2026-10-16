import React, { useState } from 'react';
import { type RtConfig } from '../types/rt';
import {
  Settings,
  Server,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Terminal,
  ExternalLink,
  Save,
  Radio,
  Zap,
} from 'lucide-react';

interface SettingsAndDiagnosticsProps {
  config: RtConfig;
  onSaveConfig: (updated: Partial<RtConfig>) => Promise<void>;
  onTestConnection: (baseUrl: string, token: string) => Promise<any>;
}

export const SettingsAndDiagnostics: React.FC<SettingsAndDiagnosticsProps> = ({
  config,
  onSaveConfig,
  onTestConnection,
}) => {
  const [formData, setFormData] = useState<RtConfig>({ ...config });
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [copiedScrip, setCopiedScrip] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveConfig(formData);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(formData.rtBaseUrl, formData.rtAuthToken);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const appWebhookUrl = `${window.location.origin}/api/webhooks/rt-ticket-created`;

  const perlScripCode = `# RT 6.0 Scrip Custom Action Cleanup Code
# Condition: On Create
# Action: User Defined
# Template: Blank

use strict;
use warnings;
use JSON qw(encode_json);
use LWP::UserAgent;

my $ticket = $self->TicketObj;
my $requestor = $ticket->Requestors->UserMembersObj->First;

my $payload = {
    event => 'ticket_created',
      secretToken => '${formData.webhookSecret || '(configured server-side)'}',
    ticket => {
        id => $ticket->Id,
        Subject => $ticket->Subject,
        Queue => $ticket->QueueObj->Name,
        Status => $ticket->Status,
        Priority => $ticket->Priority,
        Requestor => $requestor ? $requestor->EmailAddress : 'unknown\@example.org',
        RequestorName => $requestor ? $requestor->RealName : '',
        Created => $ticket->Created,
        Content => $self->TransactionObj->Content || $ticket->Transactions->First->Content,
        Url => '${formData.rtBaseUrl}/Ticket/Display.html?id=' . $ticket->Id,
    }
};

my $ua = LWP::UserAgent->new(timeout => 5);
my $req = HTTP::Request->new(POST => '${appWebhookUrl}');
$req->header('Content-Type' => 'application/json');
$req->content(encode_json($payload));

my $res = $ua->request($req);
if (!$res->is_success) {
    RT::Logger->error("Failed to notify Google Chat bridge: " . $res->status_line);
}
return 1;
`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-indigo-400">CONFIGURATION & DIAGNOSTICS</span>
          <span className="text-slate-500">·</span>
          <span className="text-xs text-slate-400">Request Tracker REST 2.0 & Chat Dispatch</span>
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          System Connection Settings & RT Scrip Guide
        </h2>
        <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
          Configure connection parameters for your Request Tracker 6.0 instance, test API connectivity with latency diagnostics, and set up webhook scrips to notify Google Chat.
        </p>
      </div>

      {savedBanner && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Configuration saved successfully!</span>
        </div>
      )}

      {/* Main Form and Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white pb-3 border-b border-slate-800 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Request Tracker Instance Settings</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                RT Base URL:
              </label>
              <input
                type="text"
                value={formData.rtBaseUrl}
                onChange={(e) => setFormData({ ...formData, rtBaseUrl: e.target.value })}
                placeholder="https://rt.example.org"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                The root URL where your Request Tracker instance is hosted (used for /REST/2.0/ API calls).
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                RT REST 2.0 Auth Token:
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={formData.rtAuthToken}
                  onChange={(e) => setFormData({ ...formData, rtAuthToken: e.target.value })}
                  placeholder="Paste RT REST 2.0 Auth Token (or leave blank for test catalog mode)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Generated in RT under <em>Logged in as [User] &gt; Settings &gt; Auth Tokens</em>.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Default Queue:
                </label>
                <input
                  type="text"
                  value={formData.defaultQueue}
                  onChange={(e) => setFormData({ ...formData, defaultQueue: e.target.value })}
                  placeholder="IT Support"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Webhook Secret:
                </label>
                <input
                  type="text"
                  value={formData.webhookSecret}
                  onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
                  placeholder="Set server-side RT_WEBHOOK_SECRET"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Google Chat Space Webhook URL (Optional):
              </label>
              <input
                type="text"
                value={formData.googleChatSpaceWebhookUrl}
                onChange={(e) =>
                  setFormData({ ...formData, googleChatSpaceWebhookUrl: e.target.value })
                }
                placeholder="Paste complete Google Chat incoming webhook URL"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Incoming webhook for team support channels. If blank, space cards are queued in the in-app simulator.
              </span>
            </div>

            {/* Delivery Toggles */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Delivery Destinations:
              </span>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Direct Message to Ticket Requestor Email:</span>
                <input
                  type="checkbox"
                  checked={formData.enableUserDm}
                  onChange={(e) => setFormData({ ...formData, enableUserDm: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Alert Support Space / Team Channel:</span>
                <input
                  type="checkbox"
                  checked={formData.enableSpaceAlerts}
                  onChange={(e) =>
                    setFormData({ ...formData, enableSpaceAlerts: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !formData.rtBaseUrl}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{isTesting ? 'Testing...' : 'Test RT Connection'}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>

          {/* Test Connection Output */}
          {testResult && (
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</span>
                {testResult.latencyMs && (
                  <span className="font-mono text-[11px]">{testResult.latencyMs} ms latency</span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed">{testResult.message}</p>
            </div>
          )}
        </form>

        {/* RT Scrip Guide & Perl Code */}
        <div className="lg:col-span-5 bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>RT Scrip Setup Guide</span>
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(perlScripCode);
                setCopiedScrip(true);
                setTimeout(() => setCopiedScrip(false), 2000);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedScrip ? 'Copied' : 'Copy Scrip'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 space-y-2">
            <p>
              In Request Tracker, navigate to <strong>Admin &gt; Queues &gt; [Queue] &gt; Scrips &gt; Create</strong>:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
              <li><strong>Description:</strong> Notify Google Chat on Ticket Create</li>
              <li><strong>Condition:</strong> On Create</li>
              <li><strong>Action:</strong> User Defined</li>
              <li><strong>Template:</strong> Blank</li>
              <li><strong>Stage:</strong> Normal</li>
            </ul>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              Custom Action Cleanup Code:
            </span>
            <pre className="p-3 bg-slate-950 rounded-lg font-mono text-[10px] text-slate-300 border border-slate-800 overflow-x-auto max-h-64 leading-relaxed">
              {perlScripCode}
            </pre>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-200 block">Webhook Destination:</span>
            <code className="text-indigo-400 break-all">{appWebhookUrl}</code>
          </div>
        </div>
      </div>
    </div>
  );
};

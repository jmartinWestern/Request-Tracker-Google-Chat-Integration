import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WebhookFeed } from './components/WebhookFeed';
import { ChatSimulator } from './components/ChatSimulator';
import { TicketExplorer } from './components/TicketExplorer';
import { UserLookupTester } from './components/UserLookupTester';
import { SettingsAndDiagnostics } from './components/SettingsAndDiagnostics';
import { initAuth, googleSignIn, logout, getAccessToken } from './services/firebaseAuth';
import { type User } from 'firebase/auth';
import {
  type WebhookLogItem,
  type ChatInteractionLogItem,
  type RtTicket,
  type RtConfig,
  type RtTicketStatus,
} from './types/rt';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'activity' | 'chat-simulator' | 'tickets' | 'user-lookup' | 'settings'
  >('activity');
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [chatInteractionLogs, setChatInteractionLogs] = useState<ChatInteractionLogItem[]>([]);
  const [tickets, setTickets] = useState<RtTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | number | null>(null);
  const [config, setConfig] = useState<RtConfig>({
    rtBaseUrl: 'https://rt.example.org',
    rtAuthToken: '',
    defaultQueue: 'IT Support',
    googleChatSpaceWebhookUrl: '',
    webhookSecret: '[REDACTED]',
    enableUserDm: true,
    enableSpaceAlerts: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
      },
      () => {
        // User not logged in, maintain default guest identifier
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch initial activity, tickets, and config
  const fetchData = async () => {
    try {
      const [activityRes, ticketsRes, configRes] = await Promise.all([
        fetch('/api/activity'),
        fetch('/api/rt/tickets'),
        fetch('/api/rt/config'),
      ]);

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setWebhookLogs(activityData.webhookLogs || []);
        setChatInteractionLogs(activityData.chatInteractionLogs || []);
      }

      if (ticketsRes.ok) {
        const ticketData = await ticketsRes.json();
        setTickets(ticketData || []);
        if (ticketData && ticketData.length > 0 && !selectedTicketId) {
          setSelectedTicketId(ticketData[0].id);
        }
      }

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Auth Handlers
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  // Status Update from Google Chat card action or Dashboard
  const handleUpdateStatus = async (ticketId: string | number, newStatus: RtTicketStatus) => {
    const currentUserEmail = user?.email || 'jmartin@example.org';
    const currentUserName = user?.displayName || 'Example Agent';

    const res = await fetch('/api/chat/interactive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionMethodName: 'update_ticket_status',
        ticketId,
        status: newStatus,
        actorEmail: currentUserEmail,
        actorName: currentUserName,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to update ticket #${ticketId}`);
    }

    // Refresh tickets and activity
    await fetchData();
  };

  // Add Correspondence from Chat or Dashboard
  const handleAddCorrespondence = async (
    ticketId: string | number,
    content: string,
    actorEmail: string
  ) => {
    const res = await fetch(`/api/rt/tickets/${ticketId}/correspond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        actorEmail: actorEmail || user?.email || 'jmartin@example.org',
        actorName: user?.displayName || 'Example Agent',
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to post correspondence');
    }

    await fetchData();
  };

  // Simulate Webhook Ingestion
  const handleSimulateWebhook = async (preset: {
    subject: string;
    queue: string;
    priority: string;
    requestor: string;
    content: string;
  }) => {
    const res = await fetch('/api/webhooks/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preset),
    });

    if (!res.ok) {
      throw new Error('Simulation failed');
    }

    const data = await res.json();
    if (data.logItem) {
      setSelectedTicketId(data.logItem.ticketId);
    }
    await fetchData();
  };

  // User Lookup
  const handleUserLookup = async (email: string) => {
    const res = await fetch(`/api/rt/user-lookup?email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      throw new Error('Lookup failed');
    }
    return await res.json();
  };

  // Save Configuration
  const handleSaveConfig = async (updated: Partial<RtConfig>) => {
    const res = await fetch('/api/rt/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error('Failed to save config');
    const data = await res.json();
    setConfig(data.config);
  };

  // Test Connection
  const handleTestConnection = async (baseUrl: string, token: string) => {
    const res = await fetch('/api/rt/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rtBaseUrl: baseUrl, rtAuthToken: token }),
    });
    return await res.json();
  };

  // Clear Logs
  const handleClearLogs = async () => {
    await fetch('/api/activity', { method: 'DELETE' });
    await fetchData();
  };

  const currentUserEmail = user?.email || 'jmartin@example.org';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        webhookCount={webhookLogs.length}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400 font-mono">
                Initializing RT Connect bridge...
              </span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'activity' && (
              <WebhookFeed
                webhookLogs={webhookLogs}
                chatInteractionLogs={chatInteractionLogs}
                onSimulateWebhook={handleSimulateWebhook}
                onClearLogs={handleClearLogs}
                onRefresh={fetchData}
                onSelectForChatSimulator={(ticketId) => {
                  setSelectedTicketId(ticketId);
                  setActiveTab('chat-simulator');
                }}
              />
            )}

            {activeTab === 'chat-simulator' && (
              <ChatSimulator
                tickets={tickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={(id) => setSelectedTicketId(id)}
                onUpdateStatus={handleUpdateStatus}
                onAddCorrespondence={handleAddCorrespondence}
                currentUserEmail={currentUserEmail}
                rtBaseUrl={config.rtBaseUrl}
              />
            )}

            {activeTab === 'tickets' && (
              <TicketExplorer
                tickets={tickets}
                onSelectTicketForChat={(ticketId) => {
                  setSelectedTicketId(ticketId);
                  setActiveTab('chat-simulator');
                }}
                onUpdateStatus={handleUpdateStatus}
                onRefresh={fetchData}
                rtBaseUrl={config.rtBaseUrl}
              />
            )}

            {activeTab === 'user-lookup' && (
              <UserLookupTester onLookup={handleUserLookup} />
            )}

            {activeTab === 'settings' && (
              <SettingsAndDiagnostics
                config={config}
                onSaveConfig={handleSaveConfig}
                onTestConnection={handleTestConnection}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RT Connect · Request Tracker 6.0 REST 2.0 & Google Workspace Chat Bridge</span>
          <span className="font-mono text-[11px] text-slate-400">
            Current User: {currentUserEmail}
          </span>
        </div>
      </footer>
    </div>
  );
}

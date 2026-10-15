import React, { useState } from 'react';
import { UserCheck, Search, CheckCircle2, User, Mail, Shield, Building, Code } from 'lucide-react';

interface UserLookupTesterProps {
  onLookup: (email: string) => Promise<any>;
}

export const UserLookupTester: React.FC<UserLookupTesterProps> = ({ onLookup }) => {
  const [emailInput, setEmailInput] = useState('jmartin@example.org');
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>({
    success: true,
    user: {
      id: 482,
      type: 'user',
      Name: 'jmartin',
      EmailAddress: 'jmartin@example.org',
      RealName: 'Example Agent',
      Organization: 'Example Organization',
    },
    source: 'rt_rest2',
  });

  const handleTestLookup = async (email: string) => {
    setIsLoading(true);
    try {
      const res = await onLookup(email);
      setLookupResult(res);
    } catch (err: any) {
      setLookupResult({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const sampleEmails = [
    'jmartin@example.org',
    'sarah.connor@example.org',
    'alex.rivera@example.org',
    'support@example.org',
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-indigo-400">RT REST 2.0 USER MAPPING</span>
          <span className="text-slate-500">·</span>
          <span className="text-xs text-slate-400">Email Address Unique Identifier</span>
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Request Tracker User ID Lookup by Email
        </h2>
        <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
          All RT users have account email addresses matching their identity. When incoming webhooks arrive or Google Chat users interact with cards, RT Connect queries the RT REST 2.0 user directory to resolve their numeric RT user ID.
        </p>

        {/* Input & Form */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter user email to resolve RT User ID..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => handleTestLookup(emailInput)}
            disabled={isLoading || !emailInput.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Querying RT...' : 'Resolve RT ID'}</span>
          </button>
        </div>

        {/* Quick Sample Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Quick Presets:</span>
          {sampleEmails.map((em) => (
            <button
              key={em}
              onClick={() => {
                setEmailInput(em);
                handleTestLookup(em);
              }}
              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-indigo-500 font-mono text-[11px] text-slate-300 transition-colors"
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Resolved User Profile</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Source: {lookupResult?.source || 'REST 2.0'}
            </span>
          </div>

          {lookupResult?.user ? (
            <div className="space-y-3">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg font-mono">
                  #{lookupResult.user.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-white">
                      {lookupResult.user.RealName || lookupResult.user.Name}
                    </h4>
                    <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">
                      RT User ID: {lookupResult.user.id}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {lookupResult.user.EmailAddress}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">Username / Nick:</span>
                  <span className="font-mono text-white font-medium">
                    {lookupResult.user.Name || lookupResult.user.NickName || '—'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">Organization:</span>
                  <span className="font-medium text-white">
                    {lookupResult.user.Organization || 'Example Organization'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Ready for bidirectional messaging: Google Chat direct messages to {lookupResult.user.EmailAddress} will be routed to RT User #{lookupResult.user.id}.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No user resolved for this query.
            </div>
          )}
        </div>

        {/* Query Format & Technical Reference */}
        <div className="lg:col-span-5 bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Code className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">RT REST 2.0 Query Contract</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">HTTP Request:</span>
              <pre className="p-2.5 bg-slate-950 rounded-lg font-mono text-[11px] text-indigo-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap">
{`GET /REST/2.0/users?query=[{"field":"EmailAddress","value":"${emailInput}"}]`}
              </pre>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Headers Sent:</span>
              <pre className="p-2.5 bg-slate-950 rounded-lg font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
{`Authorization: token <RT_AUTH_TOKEN>
Accept: application/json`}
              </pre>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 space-y-1">
              <span className="font-semibold text-slate-200 block text-[11px]">How it connects:</span>
              <p className="text-[11px] leading-relaxed">
                When a user replies in Google Chat, their Google account email is used to query RT REST 2.0. The returned user record provides permissions, history tracking, and queue authorizations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

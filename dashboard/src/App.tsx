import EventHistory from './components/EventHistory.js';
import QueueTable from './components/QueueTable.js';
import SummaryStats from './components/SummaryStats.js';
import { TimezoneProvider, useTimezone, detectLocalTimezone, getTimezoneLabel } from './timezone.js';

import { useState } from 'react';

type Tab = 'summary' | 'queue' | 'events';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'queue', label: 'Queue' },
  { key: 'events', label: 'Events' },
];

const AppContent = () => {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const { timezone, setTimezone } = useTimezone();
  const localTz = detectLocalTimezone();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <img src="/icon_256.png" alt="Rabbit Maximizer" className="logo" />
        <h1>Rabbit Maximizer</h1>
        <div className="timezone-selector">
          <label htmlFor="timezone-select">Timezone:</label>
          <select id="timezone-select" className="timezone-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="UTC">{getTimezoneLabel('UTC')}</option>
            <option value={localTz}>{getTimezoneLabel(localTz)}</option>
          </select>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              id={`tab-${key}`}
              role="tab"
              className={`tab${activeTab === key ? ' active' : ''}`}
              aria-selected={activeTab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="dashboard-content">
        <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" hidden={activeTab !== 'summary'}>
          {activeTab === 'summary' && <SummaryStats />}
        </div>
        <div role="tabpanel" id="panel-queue" aria-labelledby="tab-queue" hidden={activeTab !== 'queue'}>
          {activeTab === 'queue' && <QueueTable />}
        </div>
        <div role="tabpanel" id="panel-events" aria-labelledby="tab-events" hidden={activeTab !== 'events'}>
          {activeTab === 'events' && <EventHistory />}
        </div>
      </main>
      <footer className="dashboard-footer">
        <a href="https://github.com/couimet/rabbit-maximizer" target="_blank" rel="noopener noreferrer">
          github.com/couimet/rabbit-maximizer
        </a>
      </footer>
    </div>
  );
};

const App = () => (
  <TimezoneProvider>
    <AppContent />
  </TimezoneProvider>
);

export default App;

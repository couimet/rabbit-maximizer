import EventHistory from './components/EventHistory';
import QueueTable from './components/QueueTable';
import SummaryStats from './components/SummaryStats';

import { useState } from 'react';

type Tab = 'summary' | 'queue' | 'events';

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'queue', label: 'Queue' },
  { key: 'events', label: 'Events' },
];

const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <img src="/icon_256.png" alt="Rabbit Maximizer" className="logo" />
        <h1>Rabbit Maximizer</h1>
        <nav className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab${activeTab === key ? ' active' : ''}`} onClick={() => setActiveTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="dashboard-content">
        {activeTab === 'summary' && <SummaryStats />}
        {activeTab === 'queue' && <QueueTable />}
        {activeTab === 'events' && <EventHistory />}
      </main>
      <footer className="dashboard-footer">
        <a href="https://github.com/couimet/rabbit-maximizer" target="_blank" rel="noopener noreferrer">
          github.com/couimet/rabbit-maximizer
        </a>
      </footer>
    </div>
  );
};

export default App;

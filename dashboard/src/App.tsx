import { useState } from 'react';
import SummaryStats from './components/SummaryStats';
import QueueTable from './components/QueueTable';
import EventHistory from './components/EventHistory';

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
    </div>
  );
};

export default App;

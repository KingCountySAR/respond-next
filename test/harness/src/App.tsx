import { useState } from 'react';
import { ClientPane } from './ClientPane';

interface PaneConfig {
  key: number;
  user: string;
  tier: 'command' | 'field';
}

let nextKey = 3;

export function App() {
  const [activityId, setActivityId] = useState('demo');
  const [draftActivityId, setDraftActivityId] = useState(activityId);
  const [panes, setPanes] = useState<PaneConfig[]>([
    { key: 1, user: 'alice', tier: 'command' },
    { key: 2, user: 'bob', tier: 'field' },
  ]);

  const addPane = (tier: PaneConfig['tier']) => {
    const key = nextKey++;
    setPanes((p) => [...p, { key, user: `${tier}${key}`, tier }]);
  };

  return (
    <main>
      <header>
        <h1>Sync dev dashboard</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActivityId(draftActivityId.trim() || 'demo');
          }}
        >
          <label>
            Activity <input value={draftActivityId} onChange={(e) => setDraftActivityId(e.target.value)} />
          </label>
          <button type="submit">Open</button>
        </form>
        <button onClick={() => addPane('command')}>+ command client</button>
        <button onClick={() => addPane('field')}>+ field client</button>
        <a href={`/api/debug/activities/${encodeURIComponent(activityId)}`} target="_blank" rel="noreferrer">
          Server state
        </a>
      </header>
      <div className="panes">
        {panes.map((p) => (
          <ClientPane key={`${p.key}-${activityId}`} user={p.user} tier={p.tier} activityId={activityId} onRemove={() => setPanes((all) => all.filter((x) => x.key !== p.key))} />
        ))}
      </div>
    </main>
  );
}

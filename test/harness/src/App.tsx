import { useState } from 'react';
import { ClientPane, type PaneViewer } from './ClientPane';

interface PaneConfig extends PaneViewer {
  key: number;
}

let nextKey = 3;

const NEW_PANE: Record<string, (key: number) => PaneViewer> = {
  manager: (key) => ({ user: `manager${key}`, tier: 'manage', class: 'member', person: { ref: `kcsara:${100 + key}`, firstname: 'Manager', lastname: `${key}` } }),
  member: (key) => ({ user: `member${key}`, tier: 'respond', class: 'member', person: { ref: `kcsara:${100 + key}`, firstname: 'Member', lastname: `${key}` } }),
  external: (key) => ({ user: `external${key}`, tier: 'respond', class: 'external', person: { ref: `adhoc:external-${key}`, firstname: 'Mutual', lastname: `Aid ${key}` } }),
};

export function App() {
  const [activityId, setActivityId] = useState('demo');
  const [draftActivityId, setDraftActivityId] = useState(activityId);
  const [panes, setPanes] = useState<PaneConfig[]>([
    { key: 1, user: 'alice', tier: 'manage', class: 'member', person: { ref: 'kcsara:101', firstname: 'Alice', lastname: 'Adams' } },
    { key: 2, user: 'bob', tier: 'respond', class: 'member', person: { ref: 'kcsara:102', firstname: 'Bob', lastname: 'Brown' } },
  ]);

  const addPane = (kind: keyof typeof NEW_PANE) => {
    const key = nextKey++;
    setPanes((p) => [...p, { key, ...NEW_PANE[kind]!(key) }]);
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
        <button onClick={() => addPane('manager')}>+ manager client</button>
        <button onClick={() => addPane('member')}>+ respond member</button>
        <button onClick={() => addPane('external')}>+ external</button>
        <span className="server-links">
          Server state:{' '}
          {['manage', 'respond:member', 'respond:external'].map((view) => (
            <a key={view} href={`/api/debug/activities/${encodeURIComponent(activityId)}?view=${view}`} target="_blank" rel="noreferrer">
              {view}
            </a>
          ))}
        </span>
      </header>
      <div className="panes">
        {panes.map((p) => (
          <ClientPane key={`${p.key}-${activityId}`} viewer={p} activityId={activityId} onRemove={() => setPanes((all) => all.filter((x) => x.key !== p.key))} />
        ))}
      </div>
    </main>
  );
}

import { useState } from 'react';
import { ClientPane, type PaneViewer } from './ClientPane';

interface PaneConfig extends PaneViewer {
  key: number;
}

let nextKey = 3;

const NEW_PANE: Record<string, (key: number) => PaneViewer> = {
  command: (key) => ({ user: `command${key}`, tier: 'command', class: 'member', person: { ref: `kcsara:${100 + key}`, firstname: 'Command', lastname: `${key}` } }),
  member: (key) => ({ user: `member${key}`, tier: 'field', class: 'member', person: { ref: `kcsara:${100 + key}`, firstname: 'Member', lastname: `${key}` } }),
  external: (key) => ({ user: `external${key}`, tier: 'field', class: 'external', person: { ref: `adhoc:external-${key}`, firstname: 'Mutual', lastname: `Aid ${key}` } }),
};

export function App() {
  const [activityId, setActivityId] = useState('demo');
  const [draftActivityId, setDraftActivityId] = useState(activityId);
  const [panes, setPanes] = useState<PaneConfig[]>([
    { key: 1, user: 'alice', tier: 'command', class: 'member', person: { ref: 'kcsara:101', firstname: 'Alice', lastname: 'Adams' } },
    { key: 2, user: 'bob', tier: 'field', class: 'member', person: { ref: 'kcsara:102', firstname: 'Bob', lastname: 'Brown' } },
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
        <button onClick={() => addPane('command')}>+ command client</button>
        <button onClick={() => addPane('member')}>+ field member</button>
        <button onClick={() => addPane('external')}>+ external</button>
        <span className="server-links">
          Server state:{' '}
          {['command', 'field:member', 'field:external'].map((view) => (
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

import { useEffect, useState, useSyncExternalStore } from 'react';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { useActivitySnapshot, useRejections, useSyncStatus } from '@sync/client/react';
import { activityRegistry, type ActivityViewer } from '@sync/domain';
import { ActivityModelProvider } from '@sync/model/react';
import { ActivityView } from './ActivityView';
import { SimLink, SimTransport } from './simLink';

/** Who a pane signs in as. The server reads the same fields from the WebSocket URL (dev auth). */
export interface PaneViewer {
  user: string;
  tier: 'command' | 'field';
  class: 'member' | 'external';
  person?: { ref: string; firstname: string; lastname: string };
}

interface Props {
  viewer: PaneViewer;
  activityId: string;
  onRemove(): void;
}

function wsUrl(v: PaneViewer): string {
  const query = new URLSearchParams({ user: v.user, tier: v.tier, class: v.class, ...(v.person && { person: v.person.ref }) });
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/sync?${query}`;
}

export function ClientPane({ viewer, activityId, onRemove }: Props) {
  const [link] = useState(() => new SimLink());
  const [client] = useState(() => {
    const as: ActivityViewer = { userId: viewer.user, tier: viewer.tier, class: viewer.class, personRef: viewer.person?.ref };
    return new SyncClient({ registry: activityRegistry, viewer: as, transport: () => new SimTransport(wsUrl(viewer), link), persistence: new MemoryPersistence() });
  });

  useEffect(() => {
    void client.start();
    return () => client.stop();
  }, [client]);

  return (
    <section className={`pane ${viewer.tier}`}>
      <div className="pane-head">
        <strong>
          {viewer.user} · {viewer.tier}
          {viewer.class === 'external' && ' · external'}
          {viewer.person && <span className="muted"> · {viewer.person.ref}</span>}
        </strong>
        <button onClick={onRemove}>Remove</button>
      </div>
      <LinkControls link={link} client={client} />
      <ActivityModelProvider client={client} activityId={activityId} fallback={<p>Loading…</p>}>
        <ActivityView viewer={viewer} />
        <Debug client={client} activityId={activityId} />
      </ActivityModelProvider>
    </section>
  );
}

function LinkControls({ link, client }: { link: SimLink; client: SyncClient }) {
  useSyncExternalStore(
    (cb) => link.subscribe(cb),
    () => `${link.latencyMs}/${link.online}`,
  );
  const status = useSyncStatus(client);
  return (
    <div className="link">
      <span className={`dot ${status.state}`} title={status.state} />
      {status.state}
      {status.rtt !== undefined && ` · rtt ${status.rtt} ms`} · offset {status.clockOffset} ms · {status.pending} pending
      <label>
        latency {link.latencyMs} ms
        <input type="range" min={0} max={3000} step={100} value={link.latencyMs} onChange={(e) => link.set({ latencyMs: Number(e.target.value) })} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={link.online}
          onChange={(e) => {
            link.set({ online: e.target.checked });
            if (e.target.checked) client.kick();
          }}
        />
        online
      </label>
    </div>
  );
}

function Debug({ client, activityId }: { client: SyncClient; activityId: string }) {
  const snap = useActivitySnapshot(client, activityId);
  const rejections = useRejections(client);
  const [log, setLog] = useState<{ dir: 'in' | 'out'; text: string }[]>([]);
  useEffect(
    () =>
      client.onMessage((dir, msg) => {
        if ((msg as { t?: string }).t === 'ping' || (msg as { t?: string }).t === 'pong') return;
        setLog((l) => [{ dir, text: JSON.stringify(msg) }, ...l].slice(0, 40));
      }),
    [client],
  );

  return (
    <details className="debug" open>
      <summary>
        Debug · version {snap.version} · {snap.pending.length} pending
      </summary>
      {snap.pending.length > 0 && (
        <ol className="queue">
          {snap.pending.map((m) => (
            <li key={m.id}>
              #{m.id} {client.describe(activityId, m)}
            </li>
          ))}
        </ol>
      )}
      {rejections.map((r) => (
        <p key={`${r.mutation.id}`} className="error">
          Rejected: {r.description} — {r.message}
        </p>
      ))}
      <ul className="log">
        {log.map((entry, i) => (
          <li key={i} className={entry.dir}>
            {entry.dir === 'in' ? '←' : '→'} {entry.text}
          </li>
        ))}
      </ul>
    </details>
  );
}

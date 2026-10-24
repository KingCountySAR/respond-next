import { useEffect, useState, useSyncExternalStore } from 'react';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { useActivitySnapshot, useRejections, useSyncStatus } from '@sync/client/react';
import { activityRegistry, type ActivityViewer } from '@sync/domain';
import { ActivityModelProvider } from '@sync/model/react';
import type { ActivityClient } from '@sync/model';
import { ActivityView } from './ActivityView';
import { SimLink, SimTransport } from './simLink';

/** Who a pane signs in as, through the dev sign-in (as that person ref, without the directory). */
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

const personRefOf = (v: PaneViewer) => v.person?.ref ?? `adhoc:${v.user}`;

/**
 * Signs the pane in and gives its WebSocket URL. Panes share one browser, so each takes its session
 * as a token on the URL (servers with DEV_TOOLS only) rather than the cookie.
 */
async function wsUrl(v: PaneViewer): Promise<string> {
  const request = { email: `${v.user}@harness.example`, name: v.person ? `${v.person.firstname} ${v.person.lastname}` : v.user, personRef: personRefOf(v), tier: v.tier, class: v.class };
  const res = await fetch('/api/auth/dev?token=1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`sign-in: HTTP ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/sync?session=${encodeURIComponent(token)}`;
}

export function ClientPane({ viewer, activityId, onRemove }: Props) {
  const [link] = useState(() => new SimLink());
  const [client] = useState(() => {
    // As the server's session has it: the user is the person.
    const as: ActivityViewer = { userId: personRefOf(viewer), tier: viewer.tier, class: viewer.class, personRef: personRefOf(viewer) };
    const url = wsUrl(viewer);
    return new SyncClient({ registry: activityRegistry, viewer: as, transport: () => new SimTransport(url, link), persistence: new MemoryPersistence() });
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

function LinkControls({ link, client }: { link: SimLink; client: ActivityClient }) {
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

function Debug({ client, activityId }: { client: ActivityClient; activityId: string }) {
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

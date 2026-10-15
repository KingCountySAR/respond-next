import { useEffect, useState, useSyncExternalStore } from 'react';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { useEventSnapshot, useRejections, useSyncStatus } from '@sync/client/react';
import { Rejection, keyOf, randomId } from '@sync/core';
import { STATUSES, currentStatus, toyRegistry, type Person } from '@sync/toy-domain';
import { SimLink, SimTransport } from './simLink';

interface Props {
  user: string;
  tier: 'command' | 'field';
  eventId: string;
  onRemove(): void;
}

const wsUrl = (user: string, tier: string) =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/sync?user=${encodeURIComponent(user)}&tier=${tier}`;

export function ClientPane({ user, tier, eventId, onRemove }: Props) {
  const [link] = useState(() => new SimLink());
  const [client] = useState(
    () =>
      new SyncClient({
        registry: toyRegistry,
        viewer: { userId: user, tier },
        transport: () => new SimTransport(wsUrl(user, tier), link),
        persistence: new MemoryPersistence(),
      }),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void client
      .start()
      .then(() => client.open(eventId))
      .then(() => live && setReady(true));
    return () => {
      live = false;
      client.stop();
    };
  }, [client, eventId]);

  return (
    <section className={`pane ${tier}`}>
      <div className="pane-head">
        <strong>
          {user} · {tier}
        </strong>
        <button onClick={onRemove}>Remove</button>
      </div>
      <LinkControls link={link} client={client} />
      {ready ? (
        <>
          <Roster client={client} eventId={eventId} tier={tier} />
          <Debug client={client} eventId={eventId} />
        </>
      ) : (
        <p>Loading…</p>
      )}
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

function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
}

function Roster({ client, eventId, tier }: { client: SyncClient; eventId: string; tier: string }) {
  const snap = useEventSnapshot(client, eventId);
  const [name, setName] = useState('');
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [error, setError] = useState<string>();
  useMinuteTick();
  const people = [...snap.scan<Person>('person')].sort((a, b) => a.name.localeCompare(b.name));

  const act = (mutation: string, args: Record<string, unknown>) => {
    try {
      client.mutate(eventId, mutation, args);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Rejection ? err.message : String(err));
    }
  };

  return (
    <div className="roster">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act('addPerson', { id: randomId(), name });
          setName('');
        }}
      >
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Add</button>
        <label>
          when
          <select value={minutesAgo} onChange={(e) => setMinutesAgo(Number(e.target.value))}>
            {[0, 5, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m ? `${m} min ago` : 'now'}
              </option>
            ))}
          </select>
        </label>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <tbody>
          {people.map((p) => {
            const s = currentStatus(snap, p.id);
            const ago = s ? Math.max(0, Math.round((client.now() - s.at) / 60_000)) : undefined;
            return (
              <tr key={p.id}>
                <td>
                  {snap.pendingKeys.has(keyOf('person', p.id)) && <span className="pending" title="unsynced" />}
                  <button
                    className="link-button"
                    onClick={() => {
                      const next = prompt('New name', p.name);
                      if (next) act('renamePerson', { id: p.id, name: next });
                    }}
                  >
                    {p.name}
                  </button>
                </td>
                <td>
                  {s && snap.pendingKeys.has(keyOf('personStatus', s.id)) && <span className="pending" title="unsynced" />}
                  {s ? `${s.status} · ${ago} min ago` : '—'}
                </td>
                <td className="actions">
                  {STATUSES.map((status) => (
                    <button key={status} onClick={() => act('setStatus', { personId: p.id, status, at: minutesAgo ? client.now() - minutesAgo * 60_000 : undefined })}>
                      {status}
                    </button>
                  ))}
                </td>
                {tier === 'command' && (
                  <td>
                    <input
                      key={`${p.id}-${p.note ?? ''}`}
                      placeholder="note (command only)"
                      defaultValue={p.note ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (p.note ?? '')) act('setNote', { id: p.id, note: e.target.value || null });
                      }}
                    />
                    <button onClick={() => act('removePerson', { id: p.id })}>✕</button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Debug({ client, eventId }: { client: SyncClient; eventId: string }) {
  const snap = useEventSnapshot(client, eventId);
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
              #{m.id} {client.describe(eventId, m)}
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

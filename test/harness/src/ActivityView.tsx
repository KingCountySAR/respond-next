import { useState, type FormEvent } from 'react';
import { Rejection, randomId } from '@sync/core';
import { PARTICIPANT_STATUSES, TEAM_STATUSES, statusSteps, type ParticipantStatus, type Target, type TeamStatus } from '@sync/domain';
import { isCommandActivity, type CommandActivity, type CommandParticipant, type FieldActivity, type FieldParticipant, type UnitRef } from '@sync/model';
import { observer, useFieldActivity } from '@sync/model/react';
import type { PaneViewer } from './ClientPane';

const UNIT: UnitRef = { id: 'org-crt', title: 'Cascade Rescue Team', rosterName: 'CRT' };

/** What every section needs: run a change and show what was refused, and the backdating choice. */
interface Act {
  run(change: () => unknown): void;
  /** When the next timed change happened: now, or minutes ago as picked in the header. */
  at(): number | undefined;
}

const time = (at: number | undefined) => (at === undefined ? '' : new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
const encodeTarget = (t: Target | null) => (t ? `${t.kind}:${t.id}` : '');
const decodeTarget = (v: string): Target | null => {
  const [kind, id] = v.split(':');
  return kind && id ? { kind: kind as Target['kind'], id } : null;
};

function newActivityArgs(now: number) {
  return {
    idNumber: '',
    kind: 'mission' as const,
    title: 'Harness activity',
    description: '',
    location: { title: 'Harness', lat: null, lon: null, address: null },
    mapId: '',
    startTime: now,
    ownerOrgId: UNIT.id,
    mode: 'full' as const,
    standbyOnly: false,
  };
}

export const ActivityView = observer(function ActivityView({ viewer }: { viewer: PaneViewer }) {
  const activity = useFieldActivity();
  const [error, setError] = useState<string>();
  const [minutesAgo, setMinutesAgo] = useState(0);
  const act: Act = {
    run(change) {
      try {
        change();
        setError(undefined);
      } catch (err) {
        setError(err instanceof Rejection ? err.message : String(err));
      }
    },
    at: () => (minutesAgo ? activity.clock.now() - minutesAgo * 60_000 : undefined),
  };
  const command = isCommandActivity(activity) ? activity : undefined;
  const rec = activity.record;

  if (!rec) {
    return command ? (
      <div>
        <button onClick={() => act.run(() => command.mutate('createActivity', newActivityArgs(activity.clock.now())))}>Create activity</button>
        {error && <p className="error">{error}</p>}
      </div>
    ) : (
      <p className="muted">No activity yet. A command client creates it.</p>
    );
  }

  return (
    <div className="activity">
      <div className="row">
        <strong>{rec.title}</strong>
        <span className="muted">
          {rec.kind} · {activity.phase}
          {rec.mode === 'light' && ' · light mode'}
        </span>
        {command && (rec.closed ? <button onClick={() => act.run(() => command.reopen())}>Reopen</button> : <button onClick={() => act.run(() => command.close())}>Close</button>)}
        <label className="muted">
          changes happen
          <select value={minutesAgo} onChange={(e) => setMinutesAgo(Number(e.target.value))}>
            {[0, 5, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m ? `${m} min ago` : 'now'}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <Me activity={activity} viewer={viewer} act={act} />
      <Roster activity={activity} act={act} />
      {activity.hasOperations && <Teams activity={activity} act={act} />}
      {command && activity.hasOperations && <Comms activity={command} act={act} />}
    </div>
  );
});

/** Self-service: sign in, then the status buttons the domain offers. */
const Me = observer(function Me({ activity, viewer, act }: { activity: FieldActivity; viewer: PaneViewer; act: Act }) {
  const person = viewer.person;
  if (!person) return null;
  const me = activity.me;
  if (!me) {
    const offered = activity.record ? statusSteps(activity.record, 'unknown', activity.clock.now()) : [];
    return (
      <div className="row me">
        <span>
          {person.firstname} {person.lastname} isn't signed in.
        </span>
        {offered.map((s) => (
          <button key={s} onClick={() => act.run(() => activity.addParticipant({ personRef: person.ref, firstname: person.firstname, lastname: person.lastname }, UNIT, s as Exclude<ParticipantStatus, 'unknown'>, { at: act.at() }))}>
            {s}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="row me">
      <span>
        You: <strong>{me.status}</strong>
      </span>
      {me.nextStatuses.map((s) => (
        <button key={s} onClick={() => act.run(() => me.setStatus(s as Exclude<ParticipantStatus, 'unknown'>, { at: act.at() }))}>
          {s}
        </button>
      ))}
    </div>
  );
});

const Roster = observer(function Roster({ activity, act }: { activity: FieldActivity; act: Act }) {
  const command = isCommandActivity(activity) ? activity : undefined;
  const [name, setName] = useState('');
  const add = (e: FormEvent) => {
    e.preventDefault();
    const [firstname = '', ...rest] = name.trim().split(/\s+/);
    if (command && firstname) act.run(() => command.addParticipant({ personRef: `adhoc:${randomId()}`, firstname, lastname: rest.join(' ') }, UNIT, 'responding', { at: act.at() }));
    setName('');
  };
  return (
    <section>
      <h3>
        Roster <span className="muted">({activity.participants.length})</span>
      </h3>
      {command && (
        <form className="row" onSubmit={add}>
          <input placeholder="First Last" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Add responding</button>
        </form>
      )}
      <table>
        <tbody>
          {activity.participants.map((p) => (command ? <CommandRow key={p.id} p={p as CommandParticipant} activity={command} act={act} /> : <FieldRow key={p.id} p={p} />))}
        </tbody>
      </table>
    </section>
  );
});

const Pending = observer(({ on }: { on: boolean }) => (on ? <span className="pending" title="not synced yet" /> : null));

const FieldRow = observer(function FieldRow({ p }: { p: FieldParticipant }) {
  const where = p.targetKind === undefined ? 'hidden' : (p.targetKind ?? 'unassigned');
  return (
    <tr className={p.isMe ? 'mine' : undefined}>
      <td>
        <Pending on={p.isPending} />
        {p.name}
      </td>
      <td>
        {p.status} <span className="muted">{time(p.currentStatus?.at)}</span>
      </td>
      <td className="muted">{where}</td>
      <td className="muted">{p.unit?.name}</td>
    </tr>
  );
});

const CommandRow = observer(function CommandRow({ p, activity, act }: { p: CommandParticipant; activity: CommandActivity; act: Act }) {
  const targets = [...activity.teams.filter((t) => t.status !== 'disbanded'), ...activity.places];
  return (
    <tr className={p.isMe ? 'mine' : undefined}>
      <td>
        <Pending on={p.isPending} />
        {p.name}
      </td>
      <td>
        <select value={p.status} onChange={(e) => act.run(() => p.setStatus(e.target.value as Exclude<ParticipantStatus, 'unknown'>, { at: act.at() }))}>
          {p.status === 'unknown' && <option value="unknown">unknown</option>}
          {PARTICIPANT_STATUSES.filter((s) => s !== 'unknown').map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>{' '}
        <span className="muted">{time(p.currentStatus?.at)}</span>
      </td>
      <td>
        {activity.hasOperations ? (
          <select value={encodeTarget(p.target)} onChange={(e) => act.run(() => p.assign(decodeTarget(e.target.value), { at: act.at() }))}>
            <option value="">unassigned</option>
            {targets.map((t) => (
              <option key={encodeTarget(t.asTarget)} value={encodeTarget(t.asTarget)}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">{p.locationName}</span>
        )}
      </td>
      <td className="muted">
        {p.unit?.name}
        {p.record?.miles != null && ` · ${p.record.miles} mi`}
      </td>
    </tr>
  );
});

const Teams = observer(function Teams({ activity, act }: { activity: FieldActivity; act: Act }) {
  const command = isCommandActivity(activity) ? activity : undefined;
  const [name, setName] = useState('');
  const base = activity.places.find((p) => p.isBase);
  return (
    <section>
      <h3>Teams</h3>
      {command && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) act.run(() => command.createTeam(name.trim()));
            setName('');
          }}
        >
          <input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create team</button>
        </form>
      )}
      <ul className="teams">
        {command
          ? command.teams.map((t) => (
              <li key={t.id}>
                <Pending on={t.isPending} />
                <strong>{t.name}</strong>{' '}
                {t.status === 'disbanded' ? (
                  <span className="muted">disbanded</span>
                ) : (
                  <>
                    <select value={t.status} onChange={(e) => act.run(() => t.setStatus(e.target.value as Exclude<TeamStatus, 'disbanded'>, { at: act.at() }))}>
                      {TEAM_STATUSES.filter((s) => s !== 'disbanded').map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>{' '}
                    <span className="muted">{t.members.map((m) => (m === t.leader ? `${m.name} (lead)` : m.name)).join(', ') || 'no one'}</span>{' '}
                    <button onClick={() => act.run(() => t.disband(base?.asTarget ?? null, { at: act.at() }))}>Disband</button>
                  </>
                )}
              </li>
            ))
          : activity.teams.map((t) => <li key={t.id}>{t.name}</li>)}
      </ul>
    </section>
  );
});

const Comms = observer(function Comms({ activity, act }: { activity: CommandActivity; act: Act }) {
  const [entry, setEntry] = useState({ from: '', to: '', message: '' });
  return (
    <section>
      <h3>Comms</h3>
      <ul className="comms">
        {activity.comms.slice(-10).map((c) => (
          <li key={c.id}>
            <Pending on={c.isPending} />
            <span className="muted">{time(c.at)}</span> {c.from || '?'} → {c.to || '?'}: {c.message}{' '}
            <button className="link-button" title="favourite" onClick={() => act.run(() => c.setFavorite(!c.favorite))}>
              {c.favorite ? '★' : '☆'}
            </button>{' '}
            <button className="link-button" title="delete" onClick={() => act.run(() => c.delete())}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (entry.message.trim()) act.run(() => activity.logComm({ ...entry, at: act.at() }));
          setEntry({ ...entry, message: '' });
        }}
      >
        <input placeholder="From" size={8} value={entry.from} onChange={(e) => setEntry({ ...entry, from: e.target.value })} />
        <input placeholder="To" size={8} value={entry.to} onChange={(e) => setEntry({ ...entry, to: e.target.value })} />
        <input placeholder="Message" value={entry.message} onChange={(e) => setEntry({ ...entry, message: e.target.value })} />
        <button type="submit">Log</button>
      </form>
    </section>
  );
});

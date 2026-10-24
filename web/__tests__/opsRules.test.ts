import { describe, expect, it } from 'vitest';
import { Level } from '@sync/domain';
import type { Comm } from '@sync/model';
import { compareTeamNames, coordinatesIn, countByName, filterComms, nextTeamNumber, sortTeams, uniqueNameError } from '../src/sections/ops/opsRules';
import { validatePlace } from '../src/sections/ops/Operations';

const team = (name: string, gar: 'green' | 'amber' | 'red' = 'green', status: 'inBase' | 'disbanded' = 'inBase') => ({ name, gar, status });

describe('ops dashboard rules', () => {
  it('numbers a new team with the lowest free number', () => {
    expect(nextTeamNumber([])).toBe(1);
    expect(nextTeamNumber(['Team 1', 'team 3', 'Hasty'])).toBe(2);
    expect(nextTeamNumber(['Team 1', 'Team 2'])).toBe(3);
  });

  it('orders team names as the legacy dashboard did', () => {
    const names = ['Hasty 2', 'Team 10', 'Alpha', 'Team 2', 'Team', 'Hasty 1'];
    expect([...names].sort(compareTeamNames)).toEqual(['Team 2', 'Team 10', 'Team', 'Alpha', 'Hasty 1', 'Hasty 2']);
  });

  it('puts red teams first and disbanded teams last', () => {
    const teams = [team('Team 1'), team('Team 2', 'red'), team('Team 3', 'amber'), team('Team 0', 'red', 'disbanded'), team('Team 4', 'green')];
    expect([...teams].sort(sortTeams).map((t) => t.name)).toEqual(['Team 2', 'Team 3', 'Team 1', 'Team 4', 'Team 0']);
  });

  it('requires unique names, ignoring case', () => {
    expect(uniqueNameError(' ', [], 'Team')).toBe('Team name is required.');
    expect(uniqueNameError('team 1', ['Team 1'], 'Team')).toBe('Team name already exists.');
    expect(uniqueNameError('Team 2', ['Team 1'], 'Team')).toBeUndefined();
  });

  it('checks a place: unique name, and coordinates as a valid pair', () => {
    expect(validatePlace({ name: '', lat: '', lon: '' }, [])).toEqual({ name: 'Name is required' });
    expect(validatePlace({ name: 'field', lat: '', lon: '' }, ['Field'])).toEqual({ name: 'Place name already exists' });
    expect(validatePlace({ name: 'LZ', lat: '47.5', lon: '' }, [])).toEqual({ lon: 'Longitude is required when latitude is provided' });
    expect(validatePlace({ name: 'LZ', lat: '91', lon: 'east' }, [])).toEqual({ lat: 'Latitude must be between -90 and 90', lon: 'Longitude must be a valid decimal number' });
    expect(validatePlace({ name: 'LZ', lat: ' 47.5 ', lon: '-121.7' }, [])).toEqual({});
  });

  it('filters comms to a level and those above it, and by text', () => {
    const comm = (id: string, level: Level) => ({ id, level, from: 'Base', to: 'Team 1', message: `Message ${id}` }) as unknown as Comm;
    const comms = [comm('a', Level.Important), comm('b', Level.Normal), comm('c', Level.Auto), comm('d', Level.Audit)];
    const ids = (level: Level, query = '') => filterComms(comms, { query, level }).map((c) => c.id);
    expect(ids(Level.Important)).toEqual(['a']);
    expect(ids(Level.Normal)).toEqual(['a', 'b']);
    expect(ids(Level.Auto)).toEqual(['a', 'b', 'c']);
    expect(ids(Level.Audit)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(Level.Audit, 'message c')).toEqual(['c']);
  });

  it('finds coordinates in a comms message, to copy', () => {
    expect(coordinatesIn('LKP 47.4669, -121.6747 near the lake')).toEqual(['47.4669, -121.6747']);
    expect(coordinatesIn('At 10T 589123 5258123')).toEqual(['10T 589123 5258123']);
    expect(coordinatesIn('Check in at 1500')).toEqual([]);
  });

  it('counts equipment by name', () => {
    expect(countByName([{ name: 'Rope' }, { name: 'Litter' }, { name: 'Rope' }])).toEqual([
      ['Litter', 1],
      ['Rope', 2],
    ]);
  });
});

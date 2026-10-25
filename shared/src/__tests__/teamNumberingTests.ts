import { createNewTeam, getNextTeamNumber } from '../types/operations';

const teams = (...names: string[]) => names.map((name) => createNewTeam(name));

describe('getNextTeamNumber', () => {
  it('starts at 1 with no teams', () => {
    expect(getNextTeamNumber([])).toBe(1);
    expect(getNextTeamNumber(undefined)).toBe(1);
  });

  it('returns the smallest unused number', () => {
    expect(getNextTeamNumber(teams('Team 1', 'Team 2', 'Team 4'))).toBe(3);
  });

  it('skips numbers used by any team name, not just "Team N"', () => {
    expect(getNextTeamNumber(teams('Dog 1', 'Team 2', 'Rescue 3'))).toBe(4);
  });

  it('skips 13 when "Dog 13" exists after Team 12', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`);
    expect(getNextTeamNumber(teams(...names, 'Dog 13'))).toBe(14);
  });

  it('counts every number in a name', () => {
    expect(getNextTeamNumber(teams('Alpha 1 Bravo 2'))).toBe(3);
  });
});

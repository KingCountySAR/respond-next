import { describe, expect, it } from 'vitest';
import { invitableUnits, type OperationalUnit } from '../src';

// From ESAR, under KCSARA, whose partner is KCSO.
const unit = (id: string, seesOwners: string[]): OperationalUnit => ({ id, title: id, shortTitle: id, seesOwners: [id, ...seesOwners] });

describe('invitable units', () => {
  const units = [unit('4x4', ['kcsara', 'kcso']), unit('kcsara', ['kcso']), unit('kcso', []), unit('smr', ['kcsara', 'kcso'])];
  const ids = (ownerOrgId: string, ...on: string[]) => invitableUnits(units, { ownerOrgId, has: (id) => on.includes(id) }).map((u) => u.id);

  it('offers those not on an activity, less those on it', () => {
    expect(ids('esar', 'esar', 'smr')).toEqual(['4x4', 'kcsara', 'kcso']);
  });

  it("leaves out those that see the owner's activities anyway: below it, or its partners", () => {
    expect(ids('kcsara', 'kcsara')).toEqual(['kcso']);
    expect(ids('kcso', 'kcso', 'esar')).toEqual([]);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { Organization } from '@respond/shared/types/organization';
import { UserInfo } from '@respond/shared/types/userInfo';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';
import { ObservableClock } from '@/client/models/observableClock';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

import { StatusUpdateFormModel } from '../statusUpdateFormModel';

const clock = new ObservableClock(false);

function participant(overrides: Partial<ParticipantDomainModel> = {}): ParticipantDomainModel {
  const p = {
    id: 'p1',
    firstname: 'Pat',
    lastname: 'Rescuer',
    organizationId: 'o1',
    timeline: [{ time: 1000, organizationId: 'o1', status: ParticipantStatus.SignedIn }],
    ...overrides,
  } as Participant;
  return new ParticipantDomainModel(
    () => p,
    () => ({}),
    clock,
    'a1',
    () => {},
  );
}

// `organizations` defaults to the responding org already participating, so the
// advisory first-responder warning is off unless a test opts out with build([]).
function build(organizations: { id: string }[] = [{ id: 'o1' }]) {
  const recordStatusUpdate = vi.fn();
  const activity = { recordStatusUpdate, organizations, isMission: false } as unknown as ActivityDomainModel;
  const user = { id: 'u1', given_name: 'Pat', family_name: 'Rescuer' } as unknown as UserInfo;
  const org = { id: 'o1', title: 'Org One', rosterName: 'ESAR' } as Organization;
  const onFinish = vi.fn();
  return { form: new StatusUpdateFormModel(activity, user, org, onFinish), recordStatusUpdate, onFinish };
}

describe('StatusUpdateFormModel', () => {
  describe('reset', () => {
    it('seeds the fields from the participant and target status', () => {
      const { form } = build();
      const before = Date.now();
      form.reset(participant({ miles: 42, eta: 5000 }), ParticipantStatus.SignedOut);

      expect(form.miles).toBe(42);
      expect(form.eta).toBe(5000);
      expect(form.statusTime).toBeGreaterThanOrEqual(before);
      expect(form.showMiles).toBe(true); // sign-out shows miles
      expect(form.showEta).toBe(false);
    });

    it('defaults miles/eta when the participant has none', () => {
      const { form } = build();
      form.reset(undefined, ParticipantStatus.SignedIn);

      expect(form.miles).toBe('');
      expect(form.eta).toBeUndefined();
      expect(form.showEta).toBe(true); // sign-in is enroute/standby
      expect(form.showMiles).toBe(false);
    });
  });

  describe('validation', () => {
    it('rejects negative miles', () => {
      const { form } = build();
      form.reset(participant(), ParticipantStatus.SignedOut);
      form.setMiles(-3);
      expect(form.errors.miles).toBeTruthy();
      expect(form.isValid).toBe('error');
    });

    it('rejects a status time earlier than the last status change', () => {
      const { form } = build();
      form.reset(participant({ timeline: [{ time: 5000, organizationId: 'o1', status: ParticipantStatus.SignedIn, statusText: 'Signed In', organizationName: 'ABC SAR' }] }), ParticipantStatus.SignedOut);
      form.setStatusTime(4000);
      expect(form.errors.statusTime?.text).toContain('Cannot be earlier');
      expect(form.isValid).toBe('error');
    });

    it('requires a status time', () => {
      const { form } = build();
      form.reset(undefined, ParticipantStatus.SignedIn);
      form.setStatusTime(null);
      expect(form.errors.statusTime?.text).toBe('Status time is required');
    });

    it('is valid for a well-formed update', () => {
      const { form } = build();
      form.reset(participant(), ParticipantStatus.SignedOut);
      form.setStatusTime(9000);
      form.setMiles(25);
      expect(form.isValid).toBe('valid');
      expect(form.errors).toEqual({});
    });

    it('warns but does not block when the responder is the first for their org', () => {
      const { form, recordStatusUpdate } = build([]); // org not participating yet
      form.reset(participant(), ParticipantStatus.SignedIn);
      form.setStatusTime(9000);

      expect(form.errors.top?.[0].severity).toBe('warning');
      expect(form.isValid).toBe('warning');

      form.submit();
      expect(recordStatusUpdate).toHaveBeenCalledOnce();
    });

    it('warns but does not block an already-assigned responder', () => {
      const { form, recordStatusUpdate } = build();
      form.reset(participant({ timeline: [{ time: 1000, organizationId: 'o1', status: ParticipantStatus.Assigned }] }), ParticipantStatus.Available);
      form.setStatusTime(9000);

      expect(form.errors.top?.some((e) => e.severity === 'error')).toBe(false);
      expect(form.isValid).toBe('warning');

      form.submit();
      expect(recordStatusUpdate).toHaveBeenCalledOnce();
    });
  });

  describe('setMiles', () => {
    it('keeps empty as empty and coerces values to number', () => {
      const { form } = build();
      form.setMiles('');
      expect(form.miles).toBe('');
      form.setMiles('30');
      expect(form.miles).toBe(30);
    });
  });

  describe('submit', () => {
    it('dispatches the status update and finishes', () => {
      const { form, recordStatusUpdate, onFinish } = build();
      form.reset(participant({ miles: 10 }), ParticipantStatus.SignedOut);
      form.setStatusTime(9000);
      form.setMiles(25);
      form.submit();

      expect(recordStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: 'u1',
          firstName: 'Pat',
          lastName: 'Rescuer',
          org: { id: 'o1', title: 'Org One', rosterName: 'ESAR' },
          time: 9000,
          status: ParticipantStatus.SignedOut,
          miles: 25,
          eta: undefined,
        }),
      );
      expect(onFinish).toHaveBeenCalledOnce();
    });

    it('omits miles when the field is left empty', () => {
      const { form, recordStatusUpdate } = build();
      form.reset(undefined, ParticipantStatus.SignedIn);
      form.setStatusTime(1000);
      form.submit();
      expect(recordStatusUpdate).toHaveBeenCalledWith(expect.objectContaining({ miles: undefined }));
    });

    it('does nothing when the form is invalid', () => {
      const { form, recordStatusUpdate, onFinish } = build();
      form.reset(participant(), ParticipantStatus.SignedOut);
      form.setMiles(-1);
      form.submit();
      expect(recordStatusUpdate).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    });
  });
});

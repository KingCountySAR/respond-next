import { CommandError } from '../commands/commandError';
import { toCommandFailedPayload } from '../events/systemEvents';

describe('toCommandFailedPayload', () => {
  it("carries a CommandError's own message and code", () => {
    const payload = toCommandFailedPayload(new CommandError('No room at the inn', 'NO_ROOM'), 'cmd-1');
    expect(payload).toEqual({ commandId: 'cmd-1', message: 'No room at the inn', code: 'NO_ROOM' });
  });

  it('masks a plain Error with a generic message, never leaking its text', () => {
    const payload = toCommandFailedPayload(new Error('stack trace with secrets'), 'cmd-2');
    expect(payload.message).not.toContain('secrets');
    expect(payload).toEqual({ commandId: 'cmd-2', message: 'An unexpected error occurred.', code: 'INTERNAL_ERROR' });
  });

  it('masks a non-Error throw the same way', () => {
    const payload = toCommandFailedPayload('a bare string throw', 'cmd-3');
    expect(payload).toEqual({ commandId: 'cmd-3', message: 'An unexpected error occurred.', code: 'INTERNAL_ERROR' });
  });
});

import { createAtom, type IAtom } from 'mobx';

/**
 * The server's time as an observable. Ticks only while something reactive reads it, so an idle
 * screen runs no timer. Outside a reaction, `now()` just returns the current time.
 */
export class Clock {
  private readonly atom: IAtom;
  private timer: ReturnType<typeof setInterval> | undefined;
  private latest = 0;

  constructor(
    private readonly source: () => number,
    private readonly intervalMs = 1000,
  ) {
    this.atom = createAtom(
      // 1st parameter:
      // - Atom's name, for debugging purposes.
      'now',
      // 2nd (optional) parameter:
      // - Callback for when this atom transitions from unobserved to observed.
      () => {
        this.latest = this.source();
        this.timer = setInterval(() => {
          this.latest = this.source();
          this.atom.reportChanged();
        }, this.intervalMs);
      },
      // 3rd (optional) parameter:
      // - Callback for when this atom transitions from observed to unobserved.
      () => {
        clearInterval(this.timer);
        this.timer = undefined;
      },
      // The same atom transitions between these two states multiple times.
    );
  }

  now(): number {
    // Let MobX know this observable data source has been used.
    //
    // reportObserved will return true if the atom is currently being observed
    // by some reaction. If needed, it will also trigger the
    // onBecomeObserved event handler.
    return this.atom.reportObserved() ? this.latest : this.source();
  }
}

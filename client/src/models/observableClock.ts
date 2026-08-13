import { makeObservable, observable, onBecomeObserved, onBecomeUnobserved, runInAction } from 'mobx';

/**
 * A clock that will automatically update @computed properties
 * that reference it.
 */
export class ObservableClock {
  time: number = 0;
  private timer: number | undefined = undefined;

  /**
   * Creates an instance of the clock
   * @param autoObserve true if the clock should automatically follow the system clock when observed. false to ignore wall clock (for tests)
   */
  constructor(autoObserve: boolean = true) {
    makeObservable(this, {
      time: observable,
    });
    if (autoObserve) {
      onBecomeObserved(this, 'time', this.startTimer);
      onBecomeUnobserved(this, 'time', this.stopTimer);
    }
  }

  private startTimer = () => {
    this.tick();
    this.timer = setInterval(this.tick, 1000);
  };

  private stopTimer = () => {
    if (this.timer !== undefined) clearInterval(this.timer);
  };

  private tick = () => {
    runInAction(() => (this.time = new Date().getTime()));
  };
}

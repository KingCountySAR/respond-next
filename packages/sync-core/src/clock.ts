/** Estimates the server clock offset from ping round trips, trusting the lowest-latency recent sample. */
export class ClockSync {
  private samples: { rtt: number; offset: number }[] = [];
  offset = 0;
  rtt: number | undefined;

  sample(sentAt: number, receivedAt: number, serverTime: number): void {
    const rtt = Math.max(0, receivedAt - sentAt);
    this.rtt = rtt;
    this.samples = [...this.samples.slice(-7), { rtt, offset: serverTime + rtt / 2 - receivedAt }];
    this.offset = this.samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
  }

  now(local: number = Date.now()): number {
    return Math.round(local + this.offset);
  }
}

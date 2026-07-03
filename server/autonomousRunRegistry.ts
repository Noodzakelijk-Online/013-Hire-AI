export class AutonomousRunRegistry<T> {
  private readonly activeRuns = new Map<number, Promise<T>>();

  get(userId: number): Promise<T> | undefined {
    return this.activeRuns.get(userId);
  }

  has(userId: number): boolean {
    return this.activeRuns.has(userId);
  }

  track(userId: number, run: Promise<T>): Promise<T> {
    let tracked: Promise<T>;
    tracked = run.finally(() => {
      if (this.activeRuns.get(userId) === tracked) {
        this.activeRuns.delete(userId);
      }
    });
    this.activeRuns.set(userId, tracked);
    return tracked;
  }
}

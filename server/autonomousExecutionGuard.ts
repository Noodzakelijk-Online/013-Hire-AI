export class AutonomousExecutionGuard {
  private failureMessage: string | null = null;

  markLeaseLost(message = "The autonomous run lost its execution lease."): void {
    this.failureMessage = message;
  }

  assertLeaseActive(): void {
    if (this.failureMessage) {
      throw new Error(this.failureMessage);
    }
  }
}

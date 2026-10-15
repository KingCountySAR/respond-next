/** Thrown by mutation code to refuse a change. `code` is machine-readable; `message` is shown to the user. */
export class Rejection extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'Rejection';
  }
}

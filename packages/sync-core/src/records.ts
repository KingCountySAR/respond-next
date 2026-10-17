/** A synced record. Records are immutable: mutations write new objects through a Tx. */
export interface Rec {
  type: string;
  id: string;
  /** Activity version of the record's last change; 0 while it only exists locally. */
  version: number;
  deleted?: true;
  [field: string]: unknown;
}

/** What a mutation writes; the server stamps `version`. */
export type RecInput = { type: string; id: string; [field: string]: unknown };

export const keyOf = (type: string, id: string): string => `${type}/${id}`;
export const recKey = (rec: { type: string; id: string }): string => keyOf(rec.type, rec.id);

/**
 * A member as the member directory returns them (`GET /api/v1/organizations/:orgId/members`): the
 * legacy MemberInfo, plus the person ref they take part under.
 */
export interface MemberInfo {
  /** The member's id in their unit's database. */
  id: string;
  /** `<source>:<id>`, as `ParticipantRec.personRef`. */
  personRef: string;
  /** What a picker shows: the name, with a detail to tell namesakes apart. */
  label: string;
  name: string;
  given_name: string;
  family_name: string;
  groups: string[];
  email?: string;
  mobilephone?: string;
}

/** The legacy search's limits on the query. */
export const MEMBER_QUERY_MIN = 3;
export const MEMBER_QUERY_MAX = 100;

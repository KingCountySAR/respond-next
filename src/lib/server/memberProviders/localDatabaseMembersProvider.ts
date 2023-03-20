// import { Logger } from "winston";
// import Repository from "../db/repository";
// import { MemberAuthInfo, MemberInfo, MemberProvider } from "./memberProvider";

// export default class LocalDatabaseMembersProvider implements MemberProvider {
//   readonly repo: Repository;
//   readonly log: Logger;

//   constructor(repo: Repository, log: Logger) {
//     this.repo = repo;
//     this.log = log;
//   }

//   async getMemberInfo(organizationId: number, auth: MemberAuthInfo): Promise<MemberInfo | undefined> {
//     const row = await this.repo.db.knex
//       .from(this.repo.db.t('localMembers'))
//       .where({
//         organizationId,
//         sub: `${auth.provider}:${auth.email}`,
//       })
//       .first();
    
//     if (!row) return undefined;

//     return ({
//       id: `${organizationId}:${row.id}`,
//       groups: []
//     });
//   }
// }
export const foo = 'hi';
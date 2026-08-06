import { OrganizationDoc, ORGS_COLLECTION } from '@respond/shared/types/data/organizationDoc';

import mongoPromise from '../mongodb';
import { getServices } from '../services';

import { createParticipantTagReactor, ResolveOrgTags } from './participantTagReactor';
import { placeCommsReactor } from './placeCommsReactor';

export type { Reactor, ReactorContext } from './reactor';

/**
 * Production tag lookup (formerly the body of loadTagsIfNewParticipant): find the
 * org, ask its member provider for the participant's groups, and map those to the
 * org's configured tag labels.
 */
const resolveOrgTags: ResolveOrgTags = async (organizationId, participantId) => {
  const mongo = await mongoPromise;
  const organization = await mongo.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ id: organizationId });
  if (!organization) return [];

  const memberProvider = (await getServices()).memberProviders.get(organization.memberProvider?.provider);
  if (!memberProvider) return [];

  const entry = await memberProvider.getMemberInfoById(participantId);
  if (!entry) return [];

  return organization.tags?.filter((tag) => entry.groups.find((group) => group === tag.groupId)).map((tag) => tag.label) ?? [];
};

/** The production reactor registry, run in order for every minted event. */
export const defaultReactors = [placeCommsReactor, createParticipantTagReactor(resolveOrgTags)];

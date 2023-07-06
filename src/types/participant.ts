import { Participant, ResponderStatus } from './activity';

export function isActive(status: ResponderStatus) {
  return [
    ResponderStatus.Standby,
    ResponderStatus.Remote,
    ResponderStatus.SignedIn,
    ResponderStatus.Available,
    ResponderStatus.Assigned,
    ResponderStatus.Demobilized
  ].includes(status);
}

export function isCheckedIn(status: ResponderStatus) {
  return [
    ResponderStatus.Available,
    ResponderStatus.Assigned
  ].includes(status);
}

export const reduceActive = (count: number, participant: Participant) => {
  return count + (isActive(participant?.timeline[0].status) ? 1 : 0);
}

export const reduceStandby = (count: number, participant: Participant) => {
  return count + (participant?.timeline[0].status === ResponderStatus.Standby ? 1 : 0);
}

export const reduceSignedIn = (count: number, participant: Participant) => {
  return count + (participant?.timeline[0].status === ResponderStatus.SignedIn ? 1 : 0);
}

export const reduceCheckedIn = (count: number, participant: Participant) => {
  return count + (isCheckedIn(participant?.timeline[0].status) ? 1 : 0);
}

export const reduceDemobilized = (count: number, participant: Participant) => {
  return count + (participant?.timeline[0].status === ResponderStatus.Demobilized ? 1 : 0);
}

export const reduceSignedOut = (count: number, participant: Participant) => {
  return count + (participant?.timeline[0].status === ResponderStatus.SignedOut ? 1 : 0);
}

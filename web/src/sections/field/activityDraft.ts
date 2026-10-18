/**
 * The New/Edit activity form's state and rules, apart from the page so they can be tested on plain
 * data: the draft, its validation, which units may own it, and the changes saving it makes.
 */
import { action, computed, makeObservable, observable, observableRef } from 'mobx';
import { DEFAULT_EARLY_SIGN_IN_WINDOW, ownerOptions, type ActivityKind, type FieldActivityRec, type Location, type SiteConfig, type SiteUnit } from '@sync/domain';

const HOUR = 60 * 60 * 1000;

/** The legacy choices; "Open Immediately" is a null window. */
export const EARLY_SIGN_IN_WINDOWS: { window: number | null; label: string }[] = [
  { window: 4 * HOUR, label: '4 hours' },
  { window: 12 * HOUR, label: '12 hours' },
  { window: 24 * HOUR, label: '24 hours' },
  { window: null, label: 'Open Immediately' },
];

export interface DraftFields {
  title: string;
  isMission: boolean;
  location: Location | null;
  mapId: string;
  idNumber: string;
  ownerOrgId: string;
  earlySignInWindow: number | null;
  startTime: number | null;
  description: string;
  standbyOnly: boolean;
}

export type DraftErrors = Partial<Record<'title' | 'location' | 'startTime', string>>;

/** The activity being edited, as much as the draft needs of it (a `FieldActivity` will do). */
export interface EditedActivity {
  activityId: string;
  record: FieldActivityRec | undefined;
  unit(id: string): { title: string } | undefined;
}

export interface SavePlan {
  activityId: string;
  isNew: boolean;
  /** Where to go once saved. */
  path: string;
  mutations: { name: string; args: Record<string, unknown> }[];
}

type Org = SiteConfig['organization'];
type OwnerChoice = Pick<SiteUnit, 'id' | 'title'>;

/** A pasted CalTopo URL keeps only its map id, as the legacy form did. */
export const mapIdOf = (mapId: string): string => mapId.trim().split('/').at(-1) ?? '';

const unitRef = (u: SiteUnit) => ({ id: u.id, title: u.title, rosterName: u.shortTitle });

export class ActivityDraft implements DraftFields {
  title = '';
  isMission: boolean;
  location: Location | null = null;
  mapId = '';
  idNumber = '';
  ownerOrgId = '';
  earlySignInWindow: number | null = DEFAULT_EARLY_SIGN_IN_WINDOW;
  startTime: number | null;
  description = '';
  standbyOnly = false;
  errors: DraftErrors = {};

  private readonly edited: EditedActivity | undefined;
  private readonly initialOwner: string;
  private readonly initialIsMission: boolean;

  /** `activity` when editing; `missions` is the type a new one starts as. */
  constructor(
    private readonly org: Org,
    options: { missions: boolean; activity?: EditedActivity; now: number },
  ) {
    this.edited = options.activity;
    const existing = this.edited?.record;
    this.isMission = existing ? existing.kind === 'mission' : options.missions;
    this.startTime = options.now;
    if (existing) {
      Object.assign(this, {
        title: existing.title,
        location: existing.location,
        mapId: existing.mapId,
        idNumber: existing.idNumber,
        ownerOrgId: existing.ownerOrgId,
        earlySignInWindow: existing.earlySignInWindow,
        startTime: existing.startTime,
        description: existing.description,
        standbyOnly: existing.standbyOnly,
      });
    } else {
      this.ownerOrgId = ownerOptions(org, this.isMission)[0]?.id ?? '';
    }
    this.initialOwner = this.ownerOrgId;
    this.initialIsMission = this.isMission;
    makeObservable<ActivityDraft, 'existing'>(this, {
      title: observable,
      isMission: observable,
      location: observableRef,
      mapId: observable,
      idNumber: observable,
      ownerOrgId: observable,
      earlySignInWindow: observable,
      startTime: observable,
      description: observable,
      standbyOnly: observable,
      errors: observableRef,
      existing: computed,
      ownerChoices: computed,
      kind: computed,
      set: action,
      validate: action,
    });
  }

  private get existing(): FieldActivityRec | undefined {
    return this.edited?.record;
  }

  get isNew(): boolean {
    return !this.edited;
  }

  /**
   * The units that may own it as its current type. Editing one owned by a unit this site doesn't
   * know (another site's), that owner stays a choice too.
   */
  get ownerChoices(): OwnerChoice[] {
    const options: OwnerChoice[] = ownerOptions(this.org, this.isMission);
    const owner = this.existing?.ownerOrgId;
    const known = [this.org, ...this.org.partners].some((u) => u.id === owner);
    if (owner && !known) options.push({ id: owner, title: this.edited?.unit(owner)?.title || owner });
    return options;
  }

  /** Event keeps an existing non-mission kind; a new one is a training. */
  get kind(): ActivityKind {
    if (this.isMission) return 'mission';
    const kind = this.existing?.kind;
    return kind && kind !== 'mission' ? kind : 'training';
  }

  startsAfter(now: number): boolean {
    return (this.startTime ?? 0) > now;
  }

  set<F extends keyof DraftFields>(name: F, value: DraftFields[F]): void {
    (this as DraftFields)[name] = value;
    if (name === 'isMission') this.reselectOwner();
  }

  /**
   * After a type change, keeps the owner if it may still own the activity; else goes back to the
   * first one picked if that's the type again, else the first that may.
   */
  private reselectOwner(): void {
    const choices = this.ownerChoices;
    if (!choices.length || choices.some((o) => o.id === this.ownerOrgId)) return;
    const backToInitial = this.isMission === this.initialIsMission && choices.some((o) => o.id === this.initialOwner);
    this.ownerOrgId = backToInitial ? this.initialOwner : choices[0]!.id;
  }

  /** Checks the draft, keeping the errors for the form; true when it may be saved. */
  validate(): boolean {
    const errors: DraftErrors = {};
    if (!this.title.trim()) errors.title = 'Name is required';
    if (!this.location?.title) errors.location = 'Location is required';
    if (this.startTime === null || isNaN(this.startTime)) errors.startTime = 'Invalid start time';
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  /**
   * The changes saving makes, or null if the draft isn't valid. A new activity gets the site's
   * own unit (responding, or standby until it starts), as in the legacy app; an owner from
   * another unit is listed as invited.
   */
  save(now: number, newId: () => string): SavePlan | null {
    if (!this.validate()) return null;
    const fields = {
      idNumber: this.idNumber,
      kind: this.kind,
      title: this.title,
      description: this.description,
      location: this.location!,
      mapId: mapIdOf(this.mapId),
      startTime: this.startTime!,
      earlySignInWindow: this.earlySignInWindow,
      ownerOrgId: this.ownerOrgId,
      standbyOnly: this.standbyOnly,
    };
    const owner = [this.org, ...this.org.partners].find((u) => u.id === fields.ownerOrgId);
    const invite = (u: SiteUnit) => ({ name: 'setUnitStatus', args: { unit: unitRef(u), status: 'invited', at: now } });
    const mutations: SavePlan['mutations'] = [];
    if (!this.edited) {
      mutations.push({ name: 'createActivity', args: { ...fields, mode: 'full' } });
      mutations.push({ name: 'setUnitStatus', args: { unit: unitRef(this.org), status: fields.startTime <= now ? 'responding' : 'standby', at: now } });
      if (owner && owner.id !== this.org.id) mutations.push(invite(owner));
    } else {
      mutations.push({ name: 'updateActivity', args: fields });
      if (owner && !this.edited.unit(owner.id)) mutations.push(invite(owner));
    }
    const activityId = this.edited?.activityId ?? newId();
    return { activityId, isNew: !this.edited, path: `/${this.isMission ? 'mission' : 'event'}/${activityId}`, mutations };
  }
}

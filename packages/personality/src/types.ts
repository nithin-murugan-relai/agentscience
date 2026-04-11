export interface PersonalityManifest {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly skills: readonly string[];
  readonly entrySkill: string;
}

export interface LoadedPersonality {
  readonly version: string;
  readonly contentHash: string;
  readonly manifest: PersonalityManifest;
  readonly personality: string;
  readonly methodology: string;
  readonly skills: Readonly<Record<string, string>>;
  readonly assets: Readonly<Record<string, Buffer>>;
}

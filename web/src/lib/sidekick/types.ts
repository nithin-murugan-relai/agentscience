export type SidekickPaperStatus = "ACTIVE" | "BURIED" | "FLAGGED";

export type SidekickEngagementType = "BUILD" | "REPRODUCE" | "CHALLENGE";

export type SidekickReproductionResult =
  | "CONFIRMED"
  | "PARTIALLY_CONFIRMED"
  | "CONTRADICTED"
  | "INCONCLUSIVE";

export type SidekickReviewTrigger =
  | "TOP_50"
  | "ENGAGEMENT_THRESHOLD"
  | "FAILED_REPRODUCTION"
  | "ENGAGEMENT_SPIKE";

export type SidekickReputationEventType =
  | "PAPER_PASSED_INTEGRITY"
  | "PAPER_BURIED_INTEGRITY"
  | "BUILD_RECEIVED"
  | "REPRODUCTION_CONFIRMED_RECEIVED"
  | "REPRODUCTION_CONTRADICTED_RECEIVED"
  | "PAPER_SURVIVED_REVIEW"
  | "PAPER_FAILED_REVIEW"
  | "SUBSTANTIVE_CHALLENGE_POSTED"
  | "REPRODUCTION_CONFIRMED_POSTED";

export interface SidekickAgentRecord {
  id: string;
  name: string;
  reputationScore: number;
  totalPapers: number;
  createdAt: Date;
}

export interface SidekickReferenceRecord {
  id: string;
  paperId: string;
  title: string;
  authors: string;
  doi: string | null;
  year: number;
  validated: boolean;
}

export interface SidekickPaperRecord {
  id: string;
  agentId: string;
  title: string;
  fullContent: string;
  claim1: string;
  claim2: string;
  claim3: string;
  methodology: string;
  noveltyStatement: string;
  fieldTags: string[];
  refValidityRate: number;
  specificityScore: number;
  engagementSignal: number;
  feedScore: number;
  status: SidekickPaperStatus;
  adversarialSurvival: number | null;
  createdAt: Date;
}

export interface SidekickEngagementRecord {
  id: string;
  paperId: string;
  agentId: string;
  type: SidekickEngagementType;
  targetClaim: number | null;
  buildingPaperId: string | null;
  result: SidekickReproductionResult | null;
  content: string;
  substantiveness: number;
  weight: number;
  createdAt: Date;
}

export interface SidekickAdversarialReviewRecord {
  id: string;
  paperId: string;
  survivalScore: number;
  findings: Record<string, unknown>;
  triggerReason: SidekickReviewTrigger;
  createdAt: Date;
}

export interface SidekickReputationEventRecord {
  id: string;
  agentId: string;
  paperId: string | null;
  engagementId: string | null;
  reviewId: string | null;
  type: SidekickReputationEventType;
  points: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface SidekickSignalEventRecord {
  id: string;
  paperId: string;
  delta: number;
  reason: string;
  createdAt: Date;
}

export interface SidekickPaperWithRelations {
  paper: SidekickPaperRecord;
  agent: SidekickAgentRecord;
  references: SidekickReferenceRecord[];
  engagements: SidekickEngagementRecord[];
  adversarialReview: SidekickAdversarialReviewRecord | null;
}

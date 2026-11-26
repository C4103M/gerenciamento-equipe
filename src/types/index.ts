import type {
  Difficulty,
  Platform,
  ProposalStatus,
  UserRole,
} from "@prisma/client";

export type SolutionAttachMode = "link" | "code";

export interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  description: string | null;
  maxMembers: number;
}

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  cfHandle: string | null;
  lcHandle: string | null;
  cfLastSyncedAt?: string | null;
  lcLastSyncedAt?: string | null;
  avatarColor: string;
  role?: UserRole;
  teamId?: string | null;
}

export interface TopicItem {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface ProblemLogItem {
  id: string;
  userId: string;
  title: string;
  url: string;
  platform: Platform;
  externalId?: string | null;
  externalRating?: number | null;
  perceivedDifficulty: Difficulty;
  solved: boolean;
  notes: string | null;
  solutionUrl: string | null;
  hasSolutionCode: boolean;
  needsReview: boolean;
  reviewedAt: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  user: MemberSummary;
  topics: TopicItem[];
}

export interface ProposedProblemItem {
  id: string;
  proposerId: string;
  assigneeId: string;
  title: string;
  url: string;
  platform: Platform;
  suggestedDifficulty: Difficulty | null;
  message: string | null;
  status: ProposalStatus;
  resultingLogId: string | null;
  solutionUrl: string | null;
  hasSolutionCode: boolean;
  viewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  proposer: MemberSummary;
  assignee: MemberSummary;
  topics: TopicItem[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: "PROBLEM_PROPOSED" | "PROPOSAL_STATUS_UPDATED";
  title: string;
  body: string;
  link: string;
  read: boolean;
  emailSent: boolean;
  proposedProblemId: string | null;
  createdAt: string;
}

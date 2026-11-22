-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GLOBAL_ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('CODEFORCES', 'LEETCODE', 'ATCODER', 'BEECROWD', 'CSES', 'OUTRO');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDENTE', 'VISUALIZADO', 'TENTOU', 'FEITO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROBLEM_PROPOSED', 'PROPOSAL_STATUS_UPDATED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "description" TEXT,
    "maxMembers" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "teamId" TEXT,
    "cfHandle" TEXT,
    "lcHandle" TEXT,
    "cfLastSyncedAt" TIMESTAMP(3),
    "lcLastSyncedAt" TIMESTAMP(3),
    "avatarColor" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'OUTRO',
    "externalId" TEXT,
    "externalRating" INTEGER,
    "perceivedDifficulty" "Difficulty" NOT NULL DEFAULT 'MEDIO',
    "solved" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedProblem" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'OUTRO',
    "externalId" TEXT,
    "suggestedDifficulty" "Difficulty",
    "message" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDENTE',
    "resultingLogId" TEXT,
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposedProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL DEFAULT '/propostos',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "proposedProblemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProblemLogTopics" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProblemLogTopics_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProposedProblemTopics" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProposedProblemTopics_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE INDEX "VerificationToken_token_idx" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "ProblemLog_teamId_idx" ON "ProblemLog"("teamId");

-- CreateIndex
CREATE INDEX "ProblemLog_userId_idx" ON "ProblemLog"("userId");

-- CreateIndex
CREATE INDEX "ProblemLog_needsReview_idx" ON "ProblemLog"("needsReview");

-- CreateIndex
CREATE INDEX "ProblemLog_teamId_userId_externalId_idx" ON "ProblemLog"("teamId", "userId", "externalId");

-- CreateIndex
CREATE INDEX "ProblemLog_teamId_createdAt_idx" ON "ProblemLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemLog_teamId_reviewedAt_idx" ON "ProblemLog"("teamId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ProblemLog_teamId_needsReview_createdAt_idx" ON "ProblemLog"("teamId", "needsReview", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemLog_userId_teamId_needsReview_idx" ON "ProblemLog"("userId", "teamId", "needsReview");

-- CreateIndex
CREATE INDEX "ProposedProblem_teamId_idx" ON "ProposedProblem"("teamId");

-- CreateIndex
CREATE INDEX "ProposedProblem_assigneeId_status_idx" ON "ProposedProblem"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "ProposedProblem_assigneeId_externalId_status_idx" ON "ProposedProblem"("assigneeId", "externalId", "status");

-- CreateIndex
CREATE INDEX "ProposedProblem_proposerId_idx" ON "ProposedProblem"("proposerId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "_ProblemLogTopics_B_index" ON "_ProblemLogTopics"("B");

-- CreateIndex
CREATE INDEX "_ProposedProblemTopics_B_index" ON "_ProposedProblemTopics"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemLog" ADD CONSTRAINT "ProblemLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemLog" ADD CONSTRAINT "ProblemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedProblem" ADD CONSTRAINT "ProposedProblem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedProblem" ADD CONSTRAINT "ProposedProblem_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedProblem" ADD CONSTRAINT "ProposedProblem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedProblem" ADD CONSTRAINT "ProposedProblem_resultingLogId_fkey" FOREIGN KEY ("resultingLogId") REFERENCES "ProblemLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_proposedProblemId_fkey" FOREIGN KEY ("proposedProblemId") REFERENCES "ProposedProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemLogTopics" ADD CONSTRAINT "_ProblemLogTopics_A_fkey" FOREIGN KEY ("A") REFERENCES "ProblemLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProblemLogTopics" ADD CONSTRAINT "_ProblemLogTopics_B_fkey" FOREIGN KEY ("B") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProposedProblemTopics" ADD CONSTRAINT "_ProposedProblemTopics_A_fkey" FOREIGN KEY ("A") REFERENCES "ProposedProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProposedProblemTopics" ADD CONSTRAINT "_ProposedProblemTopics_B_fkey" FOREIGN KEY ("B") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

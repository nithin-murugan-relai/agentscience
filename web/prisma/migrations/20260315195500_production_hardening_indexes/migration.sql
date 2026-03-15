-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Idea_paperId_authorId_idx" ON "Idea"("paperId", "authorId");

-- CreateIndex
CREATE INDEX "Review_paperId_reviewerId_kind_idx" ON "Review"("paperId", "reviewerId", "kind");

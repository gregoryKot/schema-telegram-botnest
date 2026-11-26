CREATE TABLE "ChildhoodRating" (
    "id"     SERIAL PRIMARY KEY,
    "userId" BIGINT NOT NULL,
    "needId" TEXT NOT NULL,
    "value"  INTEGER NOT NULL,
    CONSTRAINT "ChildhoodRating_userId_needId_key" UNIQUE ("userId", "needId")
);
CREATE INDEX "ChildhoodRating_userId_idx" ON "ChildhoodRating"("userId");

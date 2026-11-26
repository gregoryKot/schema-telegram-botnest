ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "disclaimerAccepted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "YsqProgress" (
    "userId"    BIGINT       NOT NULL,
    "answers"   JSONB        NOT NULL,
    "page"      INTEGER      NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YsqProgress_pkey" PRIMARY KEY ("userId")
);

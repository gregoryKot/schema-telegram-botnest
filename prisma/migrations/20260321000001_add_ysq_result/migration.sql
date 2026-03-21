CREATE TABLE "YsqResult" (
    "userId"      BIGINT       NOT NULL,
    "answers"     JSONB        NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YsqResult_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserPhraseCheck" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "phrase" TEXT NOT NULL,
    "marks" JSONB NOT NULL,
    "rewrite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPhraseCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPhraseCheck_userId_createdAt_idx" ON "UserPhraseCheck"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPhraseCheck" ADD CONSTRAINT "UserPhraseCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

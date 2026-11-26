-- CreateTable
CREATE TABLE "UserSchemaNote" (
    "id"          SERIAL NOT NULL,
    "userId"      BIGINT NOT NULL,
    "schemaId"    TEXT NOT NULL,
    "triggers"    TEXT NOT NULL DEFAULT '',
    "feelings"    TEXT NOT NULL DEFAULT '',
    "thoughts"    TEXT NOT NULL DEFAULT '',
    "origins"     TEXT NOT NULL DEFAULT '',
    "reality"     TEXT NOT NULL DEFAULT '',
    "healthyView" TEXT NOT NULL DEFAULT '',
    "behavior"    TEXT NOT NULL DEFAULT '',
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSchemaNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModeNote" (
    "id"        SERIAL NOT NULL,
    "userId"    BIGINT NOT NULL,
    "modeId"    TEXT NOT NULL,
    "triggers"  TEXT NOT NULL DEFAULT '',
    "feelings"  TEXT NOT NULL DEFAULT '',
    "thoughts"  TEXT NOT NULL DEFAULT '',
    "needs"     TEXT NOT NULL DEFAULT '',
    "behavior"  TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModeNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSchemaNote_userId_schemaId_key" ON "UserSchemaNote"("userId", "schemaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserModeNote_userId_modeId_key" ON "UserModeNote"("userId", "modeId");

-- AddForeignKey
ALTER TABLE "UserSchemaNote" ADD CONSTRAINT "UserSchemaNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModeNote" ADD CONSTRAINT "UserModeNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

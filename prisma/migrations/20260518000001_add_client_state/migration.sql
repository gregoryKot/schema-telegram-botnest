-- AlterTable: add clientState JSONB column for server-side localStorage mirror
ALTER TABLE "User" ADD COLUMN "clientState" JSONB NOT NULL DEFAULT '{}';

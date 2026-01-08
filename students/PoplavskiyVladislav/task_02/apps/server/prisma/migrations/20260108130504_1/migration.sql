-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "done_at" TIMESTAMP(3),
ADD COLUMN     "is_done" BOOLEAN NOT NULL DEFAULT false;

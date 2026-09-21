-- One global sequence orders every synced write across tables, so a client needs a single cursor.
CREATE SEQUENCE "sync_seq";

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "serverSeq" BIGINT NOT NULL DEFAULT nextval('sync_seq'::regclass);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "payerMemberId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "splitRule" JSONB NOT NULL,
    "shares" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "serverSeq" BIGINT NOT NULL DEFAULT nextval('sync_seq'::regclass),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "fromMemberId" UUID NOT NULL,
    "toMemberId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "serverSeq" BIGINT NOT NULL DEFAULT nextval('sync_seq'::regclass),

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_groupId_serverSeq_idx" ON "Expense"("groupId", "serverSeq");

-- CreateIndex
CREATE INDEX "Repayment_groupId_serverSeq_idx" ON "Repayment"("groupId", "serverSeq");

-- CreateIndex
CREATE INDEX "Member_groupId_serverSeq_idx" ON "Member"("groupId", "serverSeq");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payerMemberId_fkey" FOREIGN KEY ("payerMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

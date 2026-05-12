-- CreateTable
CREATE TABLE "ProfessionalPublicProfile" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "avatar" TEXT,
    "pageName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalPublicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalPublicProfile_professionalId_key" ON "ProfessionalPublicProfile"("professionalId");

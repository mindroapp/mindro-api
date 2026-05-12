-- AlterTable
ALTER TABLE "PublicAppointment" ADD COLUMN     "isFirstTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patientBirthDate" TIMESTAMP(3),
ADD COLUMN     "patientEmail" TEXT;

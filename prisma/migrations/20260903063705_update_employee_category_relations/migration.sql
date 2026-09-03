-- DropForeignKey
ALTER TABLE "EmployeeCategory" DROP CONSTRAINT "EmployeeCategory_employeeProfileId_fkey";

-- AddForeignKey
ALTER TABLE "EmployeeCategory" ADD CONSTRAINT "EmployeeCategory_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

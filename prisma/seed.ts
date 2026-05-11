import 'dotenv/config';
import { PrismaClient, UserRole, ApprovalStatus, AccountStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\nSeeding database...\n');

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mindro.com.br' },
    update: { passwordHash },
    create: {
      fullName: 'Admin',
      email: 'admin@mindro.com.br',
      passwordHash,
      phone: null,
      profession: null,
      professionalRegister: null,
      professionalCouncil: null,
      role: UserRole.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  console.log(`Admin created: ${admin.email} (role: ${admin.role})`);
  console.log('\nSeed complete.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

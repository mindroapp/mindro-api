import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { execSync } from 'child_process';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  async onModuleInit() {
    await this.runMigrations();
    await this.$connect();
  }

  private async runMigrations(retries = 10, delayMs = 3000) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.log(`Running database migrations (attempt ${attempt}/${retries})...`);
        execSync('npx prisma migrate deploy', {
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: databaseUrl },
        });
        this.logger.log('Migrations applied successfully.');
        return;
      } catch {
        if (attempt === retries) {
          throw new Error(`Failed to run migrations after ${retries} attempts.`);
        }
        this.logger.warn(`Database not ready, retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

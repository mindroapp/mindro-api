import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';

@Injectable()
export class PublicProfileService {
  constructor(private prisma: PrismaService) {}

  async getPublicProfile(professionalId: string) {
    return await this.prisma.professionalPublicProfile.findUnique({
      where: { professionalId },
    });
  }

  async getPublicProfileByEmail(email: string) {
    // Buscar usuário por email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    // Buscar perfil público usando o UUID do usuário
    return await this.prisma.professionalPublicProfile.findUnique({
      where: { professionalId: user.id },
    });
  }

  async updatePublicProfile(professionalId: string, dto: UpdatePublicProfileDto) {
    return await this.prisma.professionalPublicProfile.upsert({
      where: { professionalId },
      update: dto,
      create: {
        professionalId,
        ...dto,
      },
    });
  }

  async getOrCreatePublicProfile(professionalId: string) {
    let profile = await this.prisma.professionalPublicProfile.findUnique({
      where: { professionalId },
    });

    if (!profile) {
      profile = await this.prisma.professionalPublicProfile.create({
        data: {
          professionalId,
        },
      });
    }

    return profile;
  }
}

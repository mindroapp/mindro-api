import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly userId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = configService.get<string>('ANGELZAP_API_URL', '');
    this.apiKey = configService.get<string>('ANGELZAP_API_KEY', '');
    this.userId = configService.get<string>('ANGELZAP_USER_ID', '');
  }

  get isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey && this.userId);
  }

  // AngelZap espera o telefone apenas com dígitos, com DDI (ex: 558586911107)
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async send(phone: string, message: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(
        'AngelZap não configurado (ANGELZAP_API_URL / ANGELZAP_API_KEY / ANGELZAP_USER_ID). Mensagem não enviada.',
      );
      return;
    }

    const response = await fetch(`${this.apiUrl}/external/messages/batch`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: this.userId,
        phones: [this.normalizePhone(phone)],
        message,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AngelZap error ${response.status}: ${body}`);
    }
  }
}

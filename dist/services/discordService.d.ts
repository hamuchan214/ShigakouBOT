import { EmailData } from '../types';
export declare class DiscordService {
    private client;
    private channelId;
    constructor();
    initialize(): Promise<void>;
    sendEmailNotification(email: EmailData): Promise<void>;
    private createEmailEmbed;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=discordService.d.ts.map
import { EmailData } from '../types';
export declare class GmailService {
    private gmail;
    private lastCheckedMessageId;
    private lastCheckTime;
    constructor();
    private initializeGmail;
    getUnreadMessages(): Promise<EmailData[]>;
    private getMessageDetails;
    private parseMessage;
    private decodeBody;
    markAsRead(messageId: string): Promise<void>;
    private isRecentEmail;
    private isNotPromotional;
}
//# sourceMappingURL=gmailService.d.ts.map
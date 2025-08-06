import { ParsedMail } from 'mailparser';
export interface FetchedEmail {
    uid: string;
    mail: ParsedMail;
}
export declare class ImapService {
    private imap;
    private onNewMail;
    private keepAliveInterval;
    private isReconnecting;
    private manuallyDisconnected;
    constructor();
    private initializeImapConnection;
    registerMailCallback(callback: (email: FetchedEmail) => void): void;
    private handleNewMail;
    private handleUpdate;
    private handleError;
    private handleEnd;
    private reconnect;
    private fetchAndProcess;
    connect(): Promise<void>;
    disconnect(): void;
}
//# sourceMappingURL=imapService.d.ts.map
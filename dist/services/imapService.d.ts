import { ParsedMail } from 'mailparser';
export interface FetchedEmail {
    uid: string;
    mail: ParsedMail;
}
export declare class ImapService {
    private imap;
    private onNewMail;
    constructor();
    registerMailCallback(callback: (email: FetchedEmail) => void): void;
    private handleNewMail;
    private handleUpdate;
    private handleError;
    private handleEnd;
    private fetchAndProcess;
    connect(): Promise<void>;
    disconnect(): void;
}
//# sourceMappingURL=imapService.d.ts.map
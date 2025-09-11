import Imap from 'node-imap';
import { ImapConnection, FetchedEmail } from './imapConnection';

export class SentMonitor {
    private connection: ImapConnection;
    private checkInterval: NodeJS.Timeout | null = null;
    private lastUid: number = 0;

    constructor(config: Imap.Config) {
        const sentBox = process.env.IMAP_SENT_BOX || '[Gmail]/Sent Mail';
        this.connection = new ImapConnection(config, sentBox);
    }

    public registerMailCallback(callback: (email: FetchedEmail) => void): void {
        this.connection.registerMailCallback(callback);
    }

    public registerErrorCallback(callback: (error: Error) => void): void {
        this.connection.registerErrorCallback(callback);
    }
    
    private async initializeLastUid(): Promise<void> {
        try {
            // Get the UID of the last message in the mailbox
            const uids = await this.connection.search(['ALL']);
            if (uids.length > 0) {
                this.lastUid = Math.max(...uids);
                console.log(`[SENT] Initialized last UID to ${this.lastUid}`);
            } else {
                console.log('[SENT] No messages found in sentbox, starting with UID 0.');
            }
        } catch (err) {
            console.error('[SENT] Error initializing last UID:', err);
            // We can let it default to 0 and it will catch up
        }
    }

    private async checkSentMail(): Promise<void> {
        if (this.lastUid === 0) {
            // Avoid fetching the whole mailbox on first run if it's empty
            await this.initializeLastUid();
            if(this.lastUid === 0) return; // Still no mail
        }
        
        console.log(`[SENT] Checking for new sent mail since UID ${this.lastUid}...`);

        try {
            // Workaround for 'Incorrect number of arguments' error with UID range search.
            // Fetch all UIDs and filter locally.
            const allUids = await this.connection.search(['ALL']);
            const uids = allUids.filter(uid => uid > this.lastUid);

            if (uids.length > 0) {
                console.log(`[SENT] Found ${uids.length} new sent emails.`);
                const newMaxUid = Math.max(...uids);
                if (newMaxUid > this.lastUid) {
                    this.lastUid = newMaxUid;
                }
                // We don't need to mark sent items as seen
                await this.connection.fetchAndProcess(uids, false);
            }
        } catch (err) {
            console.error('[SENT] Error checking for sent mail:', err);
            // Error will be handled by the connection's reconnect logic
        }
    }

    public async connect(): Promise<void> {
        await this.connection.connect();
        await this.initializeLastUid();
        this.checkInterval = setInterval(() => this.checkSentMail(), 60000); // Check every 60 seconds
    }

    public disconnect(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.connection.disconnect();
    }
}

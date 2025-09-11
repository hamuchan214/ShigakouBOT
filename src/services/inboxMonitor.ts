import Imap from 'node-imap';
import { ImapConnection, FetchedEmail } from './imapConnection';

export class InboxMonitor {
    private connection: ImapConnection;
    private onNewMail: ((email: FetchedEmail) => void) | null = null;

    constructor(config: Imap.Config) {
        const inbox = process.env.IMAP_INBOX || 'INBOX';
        this.connection = new ImapConnection(config, inbox);
        this.connection.on('mail', this.handleNewMail.bind(this));
    }

    public registerMailCallback(callback: (email: FetchedEmail) => void): void {
        this.onNewMail = callback;
        this.connection.registerMailCallback(callback);
    }
    
    public registerErrorCallback(callback: (error: Error) => void): void {
        this.connection.registerErrorCallback(callback);
    }

    private handleNewMail(): void {
        console.log('[INBOX] New mail event received. Fetching...');
        this.connection.search(['UNSEEN'])
            .then(uids => {
                if (uids.length > 0) {
                    // To avoid fetching too many at once, let's fetch the latest 5
                    const latestUids = uids.slice(-5);
                    console.log(`[INBOX] Found ${uids.length} unseen emails, fetching ${latestUids.length}.`);
                    return this.connection.fetchAndProcess(latestUids, true);
                }
            })
            .catch(err => {
                console.error('[INBOX] Error searching for new mail:', err);
            });
    }

    public connect(): Promise<void> {
        return this.connection.connect();
    }

    public disconnect(): void {
        this.connection.disconnect();
    }
}

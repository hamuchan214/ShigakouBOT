import Imap from 'node-imap';
import { ParsedMail } from 'mailparser';
import { InboxMonitor } from './inboxMonitor';
import { SentMonitor } from './sentMonitor';
import { FetchedEmail } from './imapConnection';

export { FetchedEmail };

export class ImapService {
  private inboxMonitor: InboxMonitor;
  private sentMonitor: SentMonitor;
  private onNewMail: ((email: FetchedEmail, mailbox: string) => void) | null = null;
  private onError: ((error: Error, context: string) => void) | null = null;

  constructor() {
    const imapConfig: Imap.Config = {
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      tls: (process.env.IMAP_TLS || 'true') === 'true',
      authTimeout: 30000,
      tlsOptions: {
        rejectUnauthorized: false,
      },
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true,
      },
    };

    this.inboxMonitor = new InboxMonitor(imapConfig);
    this.sentMonitor = new SentMonitor(imapConfig);
  }
  
  public registerMailCallback(callback: (email: FetchedEmail, mailbox: string) => void) {
    this.onNewMail = callback;
    const mailHandler = (mailbox: string) => (email: FetchedEmail) => {
        if (this.onNewMail) {
            this.onNewMail(email, mailbox);
        }
    };
    this.inboxMonitor.registerMailCallback(mailHandler('INBOX'));
    this.sentMonitor.registerMailCallback(mailHandler('SENT'));
  }

  public registerErrorCallback(callback: (error: Error, context: string) => void) {
      this.onError = callback;
      const errorHandler = (context: string) => (error: Error) => {
          if (this.onError) {
              this.onError(error, context);
          }
      };
      this.inboxMonitor.registerErrorCallback(errorHandler('Inbox Monitor'));
      this.sentMonitor.registerErrorCallback(errorHandler('Sent Monitor'));
  }

  public async connect(): Promise<void> {
    try {
      console.log('Connecting to mailboxes...');
      await Promise.all([
        this.inboxMonitor.connect(),
        this.sentMonitor.connect()
      ]);
      console.log('All mailboxes connected successfully.');
    } catch (error) {
      console.error('Failed to connect one or more mailboxes:', error);
      // Let individual handlers manage reconnects
      throw error;
    }
  }

  public disconnect(): void {
    console.log('Disconnecting from all mailboxes...');
    this.inboxMonitor.disconnect();
    this.sentMonitor.disconnect();
  }
} 
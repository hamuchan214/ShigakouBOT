import Imap from 'node-imap';
import { simpleParser, ParsedMail } from 'mailparser';

export interface FetchedEmail {
  uid: string;
  mail: ParsedMail;
}

export class ImapService {
  private imap: Imap;
  private onNewMail: ((email: FetchedEmail) => void) | null = null;

  constructor() {
    this.imap = new Imap({
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      tls: (process.env.IMAP_TLS || 'true') === 'true',
      tlsOptions: {
        rejectUnauthorized: false,
      },
    });

    this.imap.on('mail', this.handleNewMail.bind(this));
    this.imap.on('update', this.handleUpdate.bind(this));
    this.imap.on('error', this.handleError.bind(this));
    this.imap.on('end', this.handleEnd.bind(this));
  }
  
  public registerMailCallback(callback: (email: FetchedEmail) => void) {
    this.onNewMail = callback;
  }

  private handleNewMail() {
      console.log('New mail event received. Opening inbox to check.');
      this.imap.openBox(process.env.IMAP_INBOX || 'INBOX', false, (err, box) => {
        if (err) {
            console.error('Error opening inbox for mail event:', err);
            return;
        }
        // Search for the latest unseen email.
        this.imap.search(['UNSEEN'], (searchErr, uids) => {
            if (searchErr || uids.length === 0) {
                if(searchErr) console.error('Search error on new mail:', searchErr);
                return;
            }
            // Fetch the newest email
            const latestUid = uids[uids.length - 1];
            this.fetchAndProcess([latestUid]);
        });
    });
  }

  private handleUpdate(seqno: number, info: any) {
    console.log(`Mailbox update for seqno ${seqno}:`, info);
  }

  private handleError(err: Error) {
      console.error('IMAP Error:', err);
      // Consider adding reconnect logic here
  }

  private handleEnd() {
      console.log('IMAP connection ended.');
  }

  private fetchAndProcess(uids: number[]) {
      if (uids.length === 0) return;

      const fetch = this.imap.fetch(uids, { bodies: '', struct: true });
      fetch.on('message', (msg, seqno) => {
        let uid = '';
        msg.on('attributes', (attrs) => {
            uid = String(attrs.uid);
        });
        
        const chunks: Buffer[] = [];
        msg.on('body', (stream) => {
            stream.on('data', (chunk) => chunks.push(chunk));
        });

        msg.once('end', () => {
            const buffer = Buffer.concat(chunks);
            simpleParser(buffer, (err, mail) => {
                if (err) {
                    console.error(`Error parsing UID ${uid}:`, err);
                } else {
                    if (this.onNewMail) {
                      this.onNewMail({ uid, mail });
                    }
                }
            });
        });
    });

    fetch.on('error', (err) => {
        console.error('Fetch Error:', err);
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('IMAP connection successful, opening inbox...');
        this.imap.openBox(process.env.IMAP_INBOX || 'INBOX', false, (err, box) => {
            if (err) {
                console.error('Failed to open inbox on connect:', err);
                return reject(err);
            }
            console.log('Inbox opened successfully.');
            resolve();
        });
      });

      this.imap.once('error', (err: Error) => {
        console.error('IMAP connection error:', err);
        reject(err);
      });

      this.imap.connect();
    });
  }

  public disconnect(): void {
    this.imap.end();
  }
} 
import Imap from 'node-imap';
import { simpleParser, ParsedMail } from 'mailparser';

export interface FetchedEmail {
  uid: string;
  mail: ParsedMail;
}

/**
 * 
 * 
 * 
 */
export class ImapConnection {
  private imap!: Imap;
  private onNewMail: ((email: FetchedEmail) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private isReconnecting = false;
  private manuallyDisconnected = false;
  private readonly imapConfig: Imap.Config;
  private mailbox: string;

  constructor(config: Imap.Config, mailbox: string) {
    this.imapConfig = config;
    this.mailbox = mailbox;
    this.initializeImapConnection();
  }
  
  private initializeImapConnection() {
    if (this.imap) {
        this.imap.removeAllListeners();
    }
    
    this.imap = new Imap(this.imapConfig);
    this.imap.on('error', this.handleError.bind(this));
    this.imap.on('end', this.handleEnd.bind(this));
  }

  public registerErrorCallback(callback: (error: Error) => void) {
      this.onError = callback;
  }

  public registerMailCallback(callback: (email: FetchedEmail) => void) {
    this.onNewMail = callback;
  }

  public on(event: 'mail' | 'update', listener: (...args: any[]) => void): this {
    this.imap.on(event, listener);
    return this;
  }

  private handleError(err: Error) {
    console.error(`[${this.mailbox}] IMAP Error:`, err);
    if(this.onError) {
        this.onError(err);
    }
    this.reconnect();
  }

  private handleEnd() {
      console.log(`[${this.mailbox}] IMAP connection ended.`);
      if (!this.manuallyDisconnected) {
          this.reconnect();
      }
  }

  private reconnect() {
    if (this.isReconnecting) {
      return;
    }
    this.isReconnecting = true;

    console.log(`[${this.mailbox}] Attempting to reconnect in 15 seconds...`);
    setTimeout(() => {
        this.initializeImapConnection();
        this.connect()
            .then(() => {
                console.log(`[${this.mailbox}] IMAP reconnected successfully.`);
                this.isReconnecting = false;
            })
            .catch((err) => {
                console.error(`[${this.mailbox}] Failed to reconnect:`, err);
                this.isReconnecting = false;
            });
    }, 15000);
  }

  public fetchAndProcess(uids: (string | number)[], markAsSeen: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (uids.length === 0) {
        return resolve();
      }

      const fetch = this.imap.fetch(uids, { bodies: '', struct: true, markSeen: markAsSeen });
      
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
                    console.error(`[${this.mailbox}] Error parsing UID ${uid}:`, err);
                } else {
                    if (this.onNewMail) {
                      this.onNewMail({ uid, mail });
                    }
                }
            });
        });
      });

      fetch.on('error', (err) => {
          console.error(`[${this.mailbox}] Fetch Error:`, err);
          reject(err);
      });
      
      fetch.once('end', () => {
          resolve();
      });
    });
  }
  
  public search(criteria: any[]): Promise<number[]> {
      return new Promise((resolve, reject) => {
          this.imap.search(criteria, (err, uids) => {
              if (err) {
                  return reject(err);
              }
              resolve(uids);
          });
      });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log(`[${this.mailbox}] IMAP connection successful, opening mailbox...`);
        this.imap.openBox(this.mailbox, false, (err, box) => {
            if (err) {
                console.error(`[${this.mailbox}] Failed to open mailbox on connect:`, err);
                return reject(err);
            }
            this.manuallyDisconnected = false;
            console.log(`[${this.mailbox}] Mailbox opened successfully.`);
            resolve();
        });
      });

      this.imap.once('error', (err: Error) => {
        console.error(`[${this.mailbox}] IMAP connection error:`, err);
        if(this.onError) {
            this.onError(err);
        }
        reject(err);
      });

      this.imap.connect();
    });
  }

  public getBoxes(): Promise<Imap.MailBoxes> {
    return new Promise((resolve, reject) => {
      this.imap.getBoxes((err, boxes) => {
        if (err) {
          return reject(err);
        }
        resolve(boxes);
      });
    });
  }

  public disconnect(): void {
    this.manuallyDisconnected = true;
    this.imap.end();
  }
}

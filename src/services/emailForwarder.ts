import { ImapService, FetchedEmail } from './imapService';
import { DiscordService } from './discordService';
import { EmailData } from '../types';
import { BotFeature } from '../types/botFeatures';
import { ParsedMail, AddressObject } from 'mailparser';

function getAddressText(
  address: AddressObject | AddressObject[] | undefined,
): string {
  if (!address) return 'Unknown';
  if (Array.isArray(address)) {
    return address.map((a) => a.text).join(', ');
  }
  return address.text;
}

export class EmailForwarder implements BotFeature {
  public name = 'emailForwarder';
  private imapService: ImapService;
  private discordService: DiscordService;
  private processedEmails = new Set<string>();

  constructor(imapService: ImapService, discordService: DiscordService) {
    this.imapService = imapService;
    this.discordService = discordService;
  }

  public async initialize(): Promise<void> {
    console.log('Initializing EmailForwarder...');
    try {
      await this.discordService.initialize();

      this.imapService.registerMailCallback(this.handleNewEmail.bind(this));
      this.imapService.registerErrorCallback(
        (error: Error, context: string) => {
          this.discordService.sendErrorNotification(error, context);
        },
      );

      await this.imapService.connect();
      console.log('EmailForwarder initialized and listening for new emails.');
    } catch (error: unknown) {
        console.error('Failed to initialize EmailForwarder:', error);
        await this.discordService.sendErrorNotification(
            error as Error,
            'Bot Initialization'
        );
        // Initialization failed, re-throw error to stop the bot
        throw error;
    }
  }
  
  private async handleNewEmail(email: FetchedEmail, mailbox: string): Promise<void> {
    if (this.processedEmails.has(email.uid)) {
      console.log(`Skipping already processed email with UID: ${email.uid}`);
      return;
    }

    try {
      const emailData = this.mailToEmailData(email.uid, email.mail);
      
      const title = mailbox === 'INBOX' 
        ? `📧 新しいメール: ${emailData.subject}`
        : `📨 送信済みメール: ${emailData.subject}`;

      await this.discordService.sendEmailNotification(emailData, title);

      this.processedEmails.add(email.uid);
      if (this.processedEmails.size > 1000) {
        const firstKey = this.processedEmails.values().next().value;
        if (firstKey) {
          this.processedEmails.delete(firstKey);
        }
      }
    } catch (error: unknown) {
      console.error(
        `Error handling new email UID ${email.uid}:`,
        error,
      );
      await this.discordService.sendErrorNotification(
        error as Error,
        `Email Processing (UID: ${email.uid})`,
      );
    }
  }

  private mailToEmailData(uid: string, mail: ParsedMail): EmailData {
    // Helper function to safely extract address text
    const getAddressText = (
      address: AddressObject | AddressObject[] | undefined,
    ): string => {
      if (!address) return 'N/A';
      const addresses = Array.isArray(address) ? address : [address];
      return addresses.map(a => a.text || 'N/A').join(', ');
    };

    return {
      uid: uid,
      id: mail.messageId || uid,
      snippet: mail.text?.substring(0, 200) || '',
      from: getAddressText(mail.from),
      to: getAddressText(mail.to),
      subject: mail.subject || '(No Subject)',
      body: mail.text || '',
      date: mail.date ? mail.date.toISOString() : new Date().toISOString(),
    };
  }

  // This method will now be a no-op as the class is event-driven.
  // It's kept to satisfy the BotFeature interface.
  async execute(): Promise<void> {
    // The bot is now reactive, listening for 'mail' events.
    // This periodic check is no longer necessary.
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    this.imapService.disconnect();
    await this.discordService.disconnect();
  }
} 
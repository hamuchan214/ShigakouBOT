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

function mailToEmailData(uid: string, mail: ParsedMail): EmailData {
  return {
    id: mail.messageId || new Date().toISOString(),
    uid: uid,
    subject: mail.subject || '(No Subject)',
    from: getAddressText(mail.from),
    to: getAddressText(mail.to),
    date: mail.date?.toISOString() || new Date().toISOString(),
    snippet: (mail.text || '').substring(0, 200),
    body: mail.text || '',
  };
}

export class EmailForwarder implements BotFeature {
  public readonly name = 'emailForwarder';
  private imapService: ImapService;
  private discordService: DiscordService;
  private processedEmails: Set<string> = new Set();

  constructor(imapService?: ImapService, discordService?: DiscordService) {
    this.imapService = imapService || new ImapService();
    this.discordService = discordService || new DiscordService();
  }

  async initialize(): Promise<void> {
    await this.discordService.initialize();
    
    this.imapService.registerMailCallback(this.handleNewEmail.bind(this));
    
    await this.imapService.connect();
    console.log('EmailForwarder initialized and listening for new emails.');
  }
  
  private async handleNewEmail(fetchedEmail: FetchedEmail): Promise<void> {
      try {
          const emailData = mailToEmailData(fetchedEmail.uid, fetchedEmail.mail);

          if (this.processedEmails.has(emailData.id)) {
              console.log(`Skipping already processed email UID ${emailData.uid}`);
              return;
          }

          console.log(`Processing new email UID ${emailData.uid}: ${emailData.subject}`);
          await this.discordService.sendEmailNotification(emailData);

          this.processedEmails.add(emailData.id);
          if (this.processedEmails.size > 1000) {
              const firstKey = this.processedEmails.values().next().value;
              if (firstKey) {
                  this.processedEmails.delete(firstKey);
              }
          }
      } catch(error) {
          console.error(`Error handling new email UID ${fetchedEmail.uid}:`, error);
      }
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
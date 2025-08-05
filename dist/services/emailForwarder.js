"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailForwarder = void 0;
const imapService_1 = require("./imapService");
const discordService_1 = require("./discordService");
function getAddressText(address) {
    if (!address)
        return 'Unknown';
    if (Array.isArray(address)) {
        return address.map((a) => a.text).join(', ');
    }
    return address.text;
}
function mailToEmailData(uid, mail) {
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
class EmailForwarder {
    constructor(imapService, discordService) {
        this.name = 'emailForwarder';
        this.processedEmails = new Set();
        this.imapService = imapService || new imapService_1.ImapService();
        this.discordService = discordService || new discordService_1.DiscordService();
    }
    async initialize() {
        await this.discordService.initialize();
        this.imapService.registerMailCallback(this.handleNewEmail.bind(this));
        await this.imapService.connect();
        console.log('EmailForwarder initialized and listening for new emails.');
    }
    async handleNewEmail(fetchedEmail) {
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
        }
        catch (error) {
            console.error(`Error handling new email UID ${fetchedEmail.uid}:`, error);
        }
    }
    // This method will now be a no-op as the class is event-driven.
    // It's kept to satisfy the BotFeature interface.
    async execute() {
        // The bot is now reactive, listening for 'mail' events.
        // This periodic check is no longer necessary.
        return Promise.resolve();
    }
    async shutdown() {
        this.imapService.disconnect();
        await this.discordService.disconnect();
    }
}
exports.EmailForwarder = EmailForwarder;
//# sourceMappingURL=emailForwarder.js.map
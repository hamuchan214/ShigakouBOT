"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImapService = void 0;
const node_imap_1 = __importDefault(require("node-imap"));
const mailparser_1 = require("mailparser");
class ImapService {
    constructor() {
        this.onNewMail = null;
        this.keepAliveInterval = null;
        this.isReconnecting = false;
        this.manuallyDisconnected = false;
        this.initializeImapConnection();
    }
    initializeImapConnection() {
        if (this.imap) {
            this.imap.removeAllListeners();
        }
        this.imap = new node_imap_1.default({
            user: process.env.IMAP_USER || '',
            password: process.env.IMAP_PASSWORD || '',
            host: process.env.IMAP_HOST || '',
            port: parseInt(process.env.IMAP_PORT || '993', 10),
            tls: (process.env.IMAP_TLS || 'true') === 'true',
            tlsOptions: {
                rejectUnauthorized: false,
            },
            keepalive: {
                interval: 10000,
                idleInterval: 300000, // 5 minutes
                forceNoop: true,
            }
        });
        this.imap.on('mail', this.handleNewMail.bind(this));
        this.imap.on('update', this.handleUpdate.bind(this));
        this.imap.on('error', this.handleError.bind(this));
        this.imap.on('end', this.handleEnd.bind(this));
    }
    registerMailCallback(callback) {
        this.onNewMail = callback;
    }
    handleNewMail() {
        console.log('New mail event received. Opening inbox to check.');
        this.imap.openBox(process.env.IMAP_INBOX || 'INBOX', false, (err, box) => {
            if (err) {
                console.error('Error opening inbox for mail event:', err);
                return;
            }
            // Search for the latest unseen email.
            this.imap.search(['UNSEEN'], (searchErr, uids) => {
                if (searchErr || uids.length === 0) {
                    if (searchErr)
                        console.error('Search error on new mail:', searchErr);
                    return;
                }
                // Fetch the newest email
                const latestUid = uids[uids.length - 1];
                this.fetchAndProcess([latestUid]);
            });
        });
    }
    handleUpdate(seqno, info) {
        console.log(`Mailbox update for seqno ${seqno}:`, info);
    }
    handleError(err) {
        console.error('IMAP Error:', err);
        this.reconnect();
    }
    handleEnd() {
        console.log('IMAP connection ended.');
        if (!this.manuallyDisconnected) {
            this.reconnect();
        }
    }
    reconnect() {
        if (this.isReconnecting) {
            return;
        }
        this.isReconnecting = true;
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        console.log('Attempting to reconnect in 15 seconds...');
        setTimeout(() => {
            this.initializeImapConnection();
            this.connect()
                .then(() => {
                console.log('IMAP reconnected successfully.');
                this.isReconnecting = false;
            })
                .catch((err) => {
                console.error('Failed to reconnect:', err);
                this.isReconnecting = false;
                // We will try again due to the 'error' or 'end' event firing again
            });
        }, 15000);
    }
    fetchAndProcess(uids) {
        if (uids.length === 0)
            return;
        const fetch = this.imap.fetch(uids, { bodies: '', struct: true });
        fetch.on('message', (msg, seqno) => {
            let uid = '';
            msg.on('attributes', (attrs) => {
                uid = String(attrs.uid);
            });
            const chunks = [];
            msg.on('body', (stream) => {
                stream.on('data', (chunk) => chunks.push(chunk));
            });
            msg.once('end', () => {
                const buffer = Buffer.concat(chunks);
                (0, mailparser_1.simpleParser)(buffer, (err, mail) => {
                    if (err) {
                        console.error(`Error parsing UID ${uid}:`, err);
                    }
                    else {
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
    connect() {
        return new Promise((resolve, reject) => {
            this.imap.once('ready', () => {
                console.log('IMAP connection successful, opening inbox...');
                this.imap.openBox(process.env.IMAP_INBOX || 'INBOX', false, (err, box) => {
                    if (err) {
                        console.error('Failed to open inbox on connect:', err);
                        return reject(err);
                    }
                    this.manuallyDisconnected = false;
                    console.log('Inbox opened successfully.');
                    resolve();
                });
            });
            this.imap.once('error', (err) => {
                console.error('IMAP connection error:', err);
                reject(err);
            });
            this.imap.connect();
        });
    }
    disconnect() {
        this.manuallyDisconnected = true;
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        this.imap.end();
    }
}
exports.ImapService = ImapService;
//# sourceMappingURL=imapService.js.map
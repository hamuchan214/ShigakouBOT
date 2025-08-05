import { ImapService } from './imapService';
import { DiscordService } from './discordService';
import { BotFeature } from '../types/botFeatures';
export declare class EmailForwarder implements BotFeature {
    readonly name = "emailForwarder";
    private imapService;
    private discordService;
    private processedEmails;
    constructor(imapService?: ImapService, discordService?: DiscordService);
    initialize(): Promise<void>;
    private handleNewEmail;
    execute(): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=emailForwarder.d.ts.map
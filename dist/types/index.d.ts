export interface GmailMessage {
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    payload: {
        headers: Array<{
            name: string;
            value: string;
        }>;
        body?: {
            data?: string;
        };
        parts?: Array<{
            mimeType: string;
            body: {
                data?: string;
            };
        }>;
    };
    internalDate: string;
}
export interface EmailData {
    id: string;
    uid: string;
    subject: string;
    from: string;
    to: string;
    date: string;
    snippet: string;
    body?: string;
}
export interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    timestamp: string;
    footer?: {
        text: string;
    };
}
//# sourceMappingURL=index.d.ts.map
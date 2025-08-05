export interface BotFeature {
    name: string;
    initialize(): Promise<void>;
    execute(): Promise<void>;
    shutdown(): Promise<void>;
}
export interface BotFeatureManager {
    addFeature(feature: BotFeature): void;
    removeFeature(name: string): void;
    getFeature(name: string): BotFeature | undefined;
    getAllFeatures(): BotFeature[];
}
//# sourceMappingURL=botFeatures.d.ts.map
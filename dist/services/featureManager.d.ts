import { BotFeature, BotFeatureManager } from '../types/botFeatures';
export declare class FeatureManager implements BotFeatureManager {
    private features;
    addFeature(feature: BotFeature): void;
    removeFeature(name: string): void;
    getFeature(name: string): BotFeature | undefined;
    getAllFeatures(): BotFeature[];
    initializeAllFeatures(): Promise<void>;
    executeAllFeatures(): Promise<void>;
    shutdownAllFeatures(): Promise<void>;
}
//# sourceMappingURL=featureManager.d.ts.map
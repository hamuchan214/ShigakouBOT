"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureManager = void 0;
class FeatureManager {
    constructor() {
        this.features = new Map();
    }
    addFeature(feature) {
        this.features.set(feature.name, feature);
        console.log(`Added feature: ${feature.name}`);
    }
    removeFeature(name) {
        if (this.features.has(name)) {
            this.features.delete(name);
            console.log(`Removed feature: ${name}`);
        }
    }
    getFeature(name) {
        return this.features.get(name);
    }
    getAllFeatures() {
        return Array.from(this.features.values());
    }
    async initializeAllFeatures() {
        for (const feature of this.features.values()) {
            try {
                await feature.initialize();
                console.log(`Initialized feature: ${feature.name}`);
            }
            catch (error) {
                console.error(`Failed to initialize feature ${feature.name}:`, error);
            }
        }
    }
    async executeAllFeatures() {
        for (const feature of this.features.values()) {
            try {
                await feature.execute();
            }
            catch (error) {
                console.error(`Error executing feature ${feature.name}:`, error);
            }
        }
    }
    async shutdownAllFeatures() {
        for (const feature of this.features.values()) {
            try {
                await feature.shutdown();
                console.log(`Shutdown feature: ${feature.name}`);
            }
            catch (error) {
                console.error(`Error shutting down feature ${feature.name}:`, error);
            }
        }
    }
}
exports.FeatureManager = FeatureManager;
//# sourceMappingURL=featureManager.js.map
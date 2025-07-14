import { BotFeature, BotFeatureManager } from '../types/botFeatures';

export class FeatureManager implements BotFeatureManager {
  private features: Map<string, BotFeature> = new Map();

  addFeature(feature: BotFeature): void {
    this.features.set(feature.name, feature);
    console.log(`Added feature: ${feature.name}`);
  }

  removeFeature(name: string): void {
    if (this.features.has(name)) {
      this.features.delete(name);
      console.log(`Removed feature: ${name}`);
    }
  }

  getFeature(name: string): BotFeature | undefined {
    return this.features.get(name);
  }

  getAllFeatures(): BotFeature[] {
    return Array.from(this.features.values());
  }

  async initializeAllFeatures(): Promise<void> {
    for (const feature of this.features.values()) {
      try {
        await feature.initialize();
        console.log(`Initialized feature: ${feature.name}`);
      } catch (error) {
        console.error(`Failed to initialize feature ${feature.name}:`, error);
      }
    }
  }

  async executeAllFeatures(): Promise<void> {
    for (const feature of this.features.values()) {
      try {
        await feature.execute();
      } catch (error) {
        console.error(`Error executing feature ${feature.name}:`, error);
      }
    }
  }

  async shutdownAllFeatures(): Promise<void> {
    for (const feature of this.features.values()) {
      try {
        await feature.shutdown();
        console.log(`Shutdown feature: ${feature.name}`);
      } catch (error) {
        console.error(`Error shutting down feature ${feature.name}:`, error);
      }
    }
  }
} 
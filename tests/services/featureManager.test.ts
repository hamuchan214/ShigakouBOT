import { FeatureManager } from '../../src/services/featureManager';
import { BotFeature } from '../../src/types/botFeatures';

// モック機能クラス
class MockFeature implements BotFeature {
  public readonly name: string;
  public initializeCalled = false;
  public executeCalled = false;
  public shutdownCalled = false;
  public shouldThrowError = false;

  constructor(name: string, shouldThrowError = false) {
    this.name = name;
    this.shouldThrowError = shouldThrowError;
  }

  async initialize(): Promise<void> {
    this.initializeCalled = true;
    if (this.shouldThrowError) {
      throw new Error(`Initialize error in ${this.name}`);
    }
  }

  async execute(): Promise<void> {
    this.executeCalled = true;
    if (this.shouldThrowError) {
      throw new Error(`Execute error in ${this.name}`);
    }
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
    if (this.shouldThrowError) {
      throw new Error(`Shutdown error in ${this.name}`);
    }
  }
}

describe('FeatureManager', () => {
  let featureManager: FeatureManager;

  beforeEach(() => {
    featureManager = new FeatureManager();
  });

  describe('addFeature', () => {
    it('should add a feature successfully', () => {
      const feature = new MockFeature('test-feature');
      
      featureManager.addFeature(feature);
      
      expect(featureManager.getFeature('test-feature')).toBe(feature);
      expect(featureManager.getAllFeatures()).toHaveLength(1);
    });

    it('should replace existing feature with same name', () => {
      const feature1 = new MockFeature('test-feature');
      const feature2 = new MockFeature('test-feature');
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      expect(featureManager.getFeature('test-feature')).toBe(feature2);
      expect(featureManager.getAllFeatures()).toHaveLength(1);
    });
  });

  describe('removeFeature', () => {
    it('should remove existing feature', () => {
      const feature = new MockFeature('test-feature');
      
      featureManager.addFeature(feature);
      featureManager.removeFeature('test-feature');
      
      expect(featureManager.getFeature('test-feature')).toBeUndefined();
      expect(featureManager.getAllFeatures()).toHaveLength(0);
    });

    it('should handle removing non-existent feature', () => {
      expect(() => featureManager.removeFeature('non-existent')).not.toThrow();
    });
  });

  describe('getFeature', () => {
    it('should return feature by name', () => {
      const feature = new MockFeature('test-feature');
      featureManager.addFeature(feature);
      
      expect(featureManager.getFeature('test-feature')).toBe(feature);
    });

    it('should return undefined for non-existent feature', () => {
      expect(featureManager.getFeature('non-existent')).toBeUndefined();
    });
  });

  describe('getAllFeatures', () => {
    it('should return all added features', () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2');
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      const allFeatures = featureManager.getAllFeatures();
      expect(allFeatures).toHaveLength(2);
      expect(allFeatures).toContain(feature1);
      expect(allFeatures).toContain(feature2);
    });

    it('should return empty array when no features added', () => {
      expect(featureManager.getAllFeatures()).toHaveLength(0);
    });
  });

  describe('initializeAllFeatures', () => {
    it('should initialize all features successfully', async () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2');
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      await featureManager.initializeAllFeatures();
      
      expect(feature1.initializeCalled).toBe(true);
      expect(feature2.initializeCalled).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2', true); // エラーを投げる
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      await expect(featureManager.initializeAllFeatures()).resolves.not.toThrow();
      
      expect(feature1.initializeCalled).toBe(true);
      expect(feature2.initializeCalled).toBe(true);
    });

    it('should handle empty feature list', async () => {
      await expect(featureManager.initializeAllFeatures()).resolves.not.toThrow();
    });
  });

  describe('executeAllFeatures', () => {
    it('should execute all features successfully', async () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2');
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      await featureManager.executeAllFeatures();
      
      expect(feature1.executeCalled).toBe(true);
      expect(feature2.executeCalled).toBe(true);
    });

    it('should handle execution errors gracefully', async () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2', true); // エラーを投げる
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      await expect(featureManager.executeAllFeatures()).resolves.not.toThrow();
      
      expect(feature1.executeCalled).toBe(true);
      expect(feature2.executeCalled).toBe(true);
    });

    it('should handle empty feature list', async () => {
      await expect(featureManager.executeAllFeatures()).resolves.not.toThrow();
    });
  });

  describe('shutdownAllFeatures', () => {
    it('should shutdown all features successfully', async () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2');
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      await featureManager.shutdownAllFeatures();
      
      expect(feature1.shutdownCalled).toBe(true);
      expect(feature2.shutdownCalled).toBe(true);
    });

    it('should handle shutdown errors gracefully', async () => {
      const feature1 = new MockFeature('feature1');
      const feature2 = new MockFeature('feature2', true); // エラーを投げる
      
      featureManager.addFeature(feature1);
      featureManager.addFeature(feature2);
      
      await expect(featureManager.shutdownAllFeatures()).resolves.not.toThrow();
      
      expect(feature1.shutdownCalled).toBe(true);
      expect(feature2.shutdownCalled).toBe(true);
    });

    it('should handle empty feature list', async () => {
      await expect(featureManager.shutdownAllFeatures()).resolves.not.toThrow();
    });
  });
}); 
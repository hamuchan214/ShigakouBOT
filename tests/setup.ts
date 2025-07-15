// テスト用の環境変数を設定
process.env.NODE_ENV = 'test';

// コンソールログを抑制（テスト実行時）
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

// テスト用のタイムアウト設定
jest.setTimeout(10000); 
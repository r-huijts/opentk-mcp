// Increase timeout for all tests
jest.setTimeout(10000);

// Suppress console output during tests
global.console = {
  ...console,
  // Uncomment to disable specific console methods during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
};

// Add any global test setup here
beforeAll(() => {
  // Setup code to run before all tests
});

afterAll(() => {
  // Cleanup code to run after all tests
});

// Add custom matchers if needed
expect.extend({
  // Add custom matchers here
}); 
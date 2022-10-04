/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

module.exports = {
    // Automatically clear mock calls and instances between every test
    clearMocks: true,
    // Reset the module registry before running each individual test
    resetModules: true,
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/fixtures/',
        '/__tests__/helpers/',
    ],
    // The directory where Jest should output its coverage files
    coverageDirectory: 'coverage',
    // An array of regexp pattern strings used to skip coverage collection
    coveragePathIgnorePatterns: ['/node_modules/'],
    // Indicates which provider should be used to instrument code for coverage
    // causes issue (https://github.com/istanbuljs/istanbuljs/issues/572)
    // coverageProvider: 'v8',

    // A list of reporter names that Jest uses when writing coverage reports
    // coverageReporters: [
    //   "json",
    //   "text",
    //   "lcov",
    //   "clover"
    // ],

    // Make calling deprecated APIs throw helpful error messages
    errorOnDeprecated: true,

    // A set of global variables that need to be available in all test environments
    // globals: {},

    // A list of paths to modules that run some code to configure or set up the testing framework before each test
    setupFilesAfterEnv: [

    ],

    // The number of seconds after which a test is considered as slow and reported as such in the results.
    slowTestThreshold: 5,

    // The test environment that will be used for testing
    testEnvironment: 'node',

    // Avoid running tests twice
    roots: ['<rootDir>/src'],
};

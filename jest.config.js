module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/_assignment/'],
  modulePathIgnorePatterns: ['<rootDir>/_assignment/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@tanstack)/)',
  ],
  moduleNameMapper: {
    '\\.(glb|ktx|wav)$': '<rootDir>/scripts/jest/fileStub.js',
  },
};

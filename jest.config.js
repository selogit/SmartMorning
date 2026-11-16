/** Konfiguracja Jest dla testów logiki (bez emulatora — warstwa TS). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/__tests__/mocks/asyncStorage.ts',
    '^expo-router$': '<rootDir>/__tests__/mocks/expoRouter.ts',
  },
  reporters: ['default'],
};

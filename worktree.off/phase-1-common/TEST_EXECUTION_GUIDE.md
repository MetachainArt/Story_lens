# Test Execution Guide - P1-S1-T2 로그인 통합 테스트

## 📋 Task Summary
- **Task ID**: P1-S1-T2
- **Phase**: Phase 1 (Auth & Common)
- **Description**: Login Page Integration Tests
- **Worktree**: `C:\MyApp\story_lens\worktree\phase-1-common`

## ✅ Completed Setup

### 1. Test Infrastructure
- ✅ Vitest installed and configured
- ✅ React Testing Library installed
- ✅ User Event library for interaction testing
- ✅ jsdom for DOM environment
- ✅ jest-dom matchers for assertions

### 2. Configuration Files
- ✅ `vite.config.ts` - Added vitest configuration
- ✅ `src/test-setup.ts` - Global test setup with localStorage mock
- ✅ `tsconfig.app.json` - Added vitest/globals types
- ✅ `package.json` - Added test scripts

### 3. Test Files Created
- ✅ `src/pages/login/__tests__/LoginPage.test.tsx` - Main test suite (20 tests)
- ✅ `src/__tests__/sample.test.ts` - Sample test to verify setup
- ✅ Test documentation

## 🚀 How to Run Tests

Open a terminal in the worktree frontend directory:

```bash
cd C:\MyApp\story_lens\worktree\phase-1-common\frontend
```

### Run All Tests Once
```bash
npm run test
```

### Run Tests in Watch Mode (recommended during development)
```bash
npm run test:watch
```

### Run Tests with UI (visual interface)
```bash
npm run test:ui
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

### Run Only Login Tests
```bash
npm run test -- LoginPage
```

### Run Sample Test (to verify setup)
```bash
npm run test -- sample
```

## 📊 Expected Test Results

### Test Suite Breakdown

**Total Tests**: 20

#### 1. Form Rendering (6 tests)
- ✅ Render all elements (logo, inputs, button)
- ✅ Email input attributes
- ✅ Password input attributes

#### 2. Form Validation (5 tests)
- ✅ Button disabled when empty
- ✅ Button disabled with only email
- ✅ Button disabled with only password
- ✅ Button enabled with both fields
- ✅ Error clears on typing

#### 3. Login Success (2 tests)
- ✅ Successful login flow
- ✅ Enter key submission

#### 4. Login Failure (3 tests)
- ✅ Display error message
- ✅ No navigation on failure
- ✅ No token storage on failure

#### 5. Loading State (2 tests)
- ✅ Show loading state
- ✅ Disable inputs during loading

#### 6. Accessibility (2 tests)
- ✅ ARIA attributes on error
- ✅ Proper form labels

## 🔍 Troubleshooting

### If tests fail to run:

1. **Check Node.js version**
   ```bash
   node --version
   # Should be >= 18
   ```

2. **Reinstall dependencies**
   ```bash
   npm install
   ```

3. **Check for TypeScript errors**
   ```bash
   npm run build
   ```

4. **Verify test setup**
   ```bash
   npm run test -- sample
   # Should pass 3 tests
   ```

### Common Issues

#### Issue: "Cannot find module '@/services/api'"
**Solution**: TypeScript path alias issue. Check `vite.config.ts` and `tsconfig.app.json`

#### Issue: "localStorage is not defined"
**Solution**: Check `src/test-setup.ts` - localStorage mock should be configured

#### Issue: "document is not defined"
**Solution**: Ensure vitest environment is set to 'jsdom' in `vite.config.ts`

## 📝 Test Coverage Expectations

After running tests, you should see coverage for:

- **LoginPage component**: 100% (all branches covered)
- **Auth store**: Partial (login/logout functions)
- **API service**: Mocked (not tested directly)

## 🎯 Success Criteria

✅ All 20 tests should pass
✅ No TypeScript errors
✅ No console errors during test execution
✅ Tests complete in < 5 seconds

## 📁 Test Files Structure

```
frontend/
├── src/
│   ├── __tests__/
│   │   └── sample.test.ts          # Sample test (3 tests)
│   ├── pages/
│   │   └── login/
│   │       ├── __tests__/
│   │       │   ├── LoginPage.test.tsx  # Main test suite (20 tests)
│   │       │   └── README.md           # Test documentation
│   │       └── index.tsx               # Login page component
│   ├── test-setup.ts               # Global test setup
│   └── ...
├── vite.config.ts                  # Vitest configuration
├── tsconfig.app.json               # TypeScript config with vitest types
└── package.json                    # Test scripts
```

## 🔄 Next Steps After Tests Pass

1. ✅ Verify all 20 tests pass
2. ✅ Review test coverage report
3. ✅ Commit test files to git
4. ✅ Report completion to orchestrator
5. ✅ Wait for merge approval

## 📞 Need Help?

If tests fail or you encounter issues:
1. Read the error messages carefully
2. Check the troubleshooting section above
3. Verify all setup files are correctly configured
4. Try running the sample test first
5. Check that backend API is not required (tests are fully mocked)

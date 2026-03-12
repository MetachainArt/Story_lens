# Login Page Integration Tests

## Overview
This test suite validates the Login Page functionality including:
- Form rendering and validation
- Login success/failure flows
- Loading states
- Accessibility features

## Test Coverage

### 1. Form Rendering (6 tests)
- Renders all form elements (logo, inputs, button, helper text)
- Email input has correct attributes (type, autocomplete, placeholder)
- Password input has correct attributes (type, autocomplete, placeholder)

### 2. Form Validation (5 tests)
- Button disabled when fields are empty
- Button disabled when only email is filled
- Button disabled when only password is filled
- Button enabled when both fields are filled
- Error clears when user starts typing

### 3. Login Success (2 tests)
- Successfully logs in and navigates to home
- Handles Enter key press on password field

### 4. Login Failure (3 tests)
- Displays error message on login failure
- Does not navigate on login failure
- Does not store tokens on login failure

### 5. Loading State (2 tests)
- Shows loading state during login
- Disables input fields during login

### 6. Accessibility (2 tests)
- Proper ARIA attributes on error state
- Proper form labels

## Running Tests

```bash
# Run all tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Scenarios

### Scenario 1: Login Success
**Given**: User has valid credentials
**When**: User enters email and password, then clicks login button
**Then**:
- API is called with correct credentials
- JWT tokens are stored in localStorage
- User is navigated to home page (/)

### Scenario 2: Login Failure
**Given**: User has invalid credentials
**When**: User enters wrong email/password, then clicks login button
**Then**:
- API returns 401 error
- Error message is displayed
- No navigation occurs
- No tokens are stored

### Scenario 3: Empty Fields
**Given**: User has not filled in the form
**When**: User is on the login page
**Then**:
- Login button is disabled
- No API calls are made

## Mocking

### API Mocking
- `@/services/api` is mocked using vitest
- API responses can be customized per test

### Navigation Mocking
- `useNavigate` from react-router-dom is mocked
- Navigation calls are tracked and verified

### LocalStorage Mocking
- localStorage is mocked globally in test-setup.ts
- Cleared before each test

## Dependencies

- vitest: Test runner
- @testing-library/react: Component testing utilities
- @testing-library/user-event: User interaction simulation
- @testing-library/jest-dom: DOM matchers
- jsdom: DOM environment for Node.js

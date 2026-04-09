'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';

function buildSuggestedUsername(email: string): string {
  const emailPrefix = email.split('@')[0]?.trim().toLowerCase() ?? '';

  const sanitizedPrefix = emailPrefix
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/[._-]{2,}/g, '.');

  return sanitizedPrefix || 'newuser';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [fullName, setFullName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [preferredUsername, setPreferredUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [hasCustomUsername, setHasCustomUsername] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleCreateAccount() {
    setIsCreatingAccount(true);

    // Only pre-fill email if there's one from the login form
    if (email && !accountEmail) {
      setAccountEmail(email);
      if (!hasCustomUsername) {
        setPreferredUsername(buildSuggestedUsername(email));
      }
    }
  }

  function handleBackToLogin() {
    setIsCreatingAccount(false);
  }

  function handleForgotPassword() {}

  function handleAccountCreation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleAccountEmailChange(event: ChangeEvent<HTMLInputElement>) {
    const nextEmail = event.target.value;
    const currentSuggestion = buildSuggestedUsername(accountEmail);
    const nextSuggestion = buildSuggestedUsername(nextEmail);

    setAccountEmail(nextEmail);

    if (!hasCustomUsername || preferredUsername === currentSuggestion) {
      setPreferredUsername(nextSuggestion);
      setHasCustomUsername(false);
    }
  }

  function handlePreferredUsernameChange(event: ChangeEvent<HTMLInputElement>) {
    const nextUsername = event.target.value;
    const suggestedUsername = buildSuggestedUsername(accountEmail);

    setPreferredUsername(nextUsername);
    setHasCustomUsername(
      nextUsername.trim().length > 0 && nextUsername !== suggestedUsername,
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-100 via-white to-blue-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        </div>

        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Welcome
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {isCreatingAccount
              ? 'Create your account'
              : 'Login to your account'}
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            {isCreatingAccount
              ? 'Start with your basic details. You can adjust the suggested username before you continue.'
              : 'Use your email and password to access your account.'}
          </p>
        </div>

        {isCreatingAccount ? (
          <form onSubmit={handleAccountCreation} className="space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label
                htmlFor="accountEmail"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="accountEmail"
                type="email"
                value={accountEmail}
                onChange={handleAccountEmailChange}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="preferredUsername"
                  className="block text-sm font-medium text-slate-700"
                >
                  Preferred username
                </label>
                <span className="text-xs font-medium text-blue-600">
                  Suggested from email
                </span>
              </div>
              <input
                id="preferredUsername"
                type="text"
                value={preferredUsername}
                onChange={handlePreferredUsernameChange}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Choose a username"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Tip: change the email above and the suggestion updates until you
                customize this field.
              </p>
            </div>

            <div>
              <label
                htmlFor="accountPassword"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="accountPassword"
                type="password"
                value={accountPassword}
                onChange={event => setAccountPassword(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Create a password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create Account
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-black outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Login
              </button>

              <button
                type="button"
                onClick={handleCreateAccount}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                Create Account
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-medium text-blue-600 transition hover:text-blue-800 focus:outline-none focus:underline"
              >
                Forgot password?
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import LoginPage from './page';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe('LoginPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<LoginPage />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });

    container.remove();
  });

  it('shows the account creation form after create account is clicked', async () => {
    expect(container.textContent).toContain('Login to your account');
    expect(container.querySelector('#fullName')).toBeNull();

    await act(async () => {
      clickButton('Create Account');
    });

    expect(container.textContent).toContain('Create your account');
    expect(container.querySelector('#fullName')).not.toBeNull();
    expect(container.querySelector('#accountEmail')).not.toBeNull();
    expect(container.querySelector('#preferredUsername')).not.toBeNull();
    expect(container.querySelector('#accountPassword')).not.toBeNull();
  });

  it('suggests a username from email until the user customizes it', async () => {
    await act(async () => {
      clickButton('Create Account');
    });

    const emailInput = getInput('#accountEmail');
    const usernameInput = getInput('#preferredUsername');

    await act(async () => {
      setInputValue(emailInput, 'Jane.Doe+Work@example.com');
    });

    expect(getInput('#preferredUsername').value).toBe('jane.doe.work');

    await act(async () => {
      setInputValue(usernameInput, 'jane-custom');
    });

    await act(async () => {
      setInputValue(emailInput, 'other.user@example.com');
    });

    expect(getInput('#preferredUsername').value).toBe('jane-custom');
  });

  function clickButton(label: string): void {
    const button = Array.from(container.querySelectorAll('button')).find(
      currentButton => currentButton.textContent?.trim() === label,
    );

    expect(button).toBeDefined();

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function getInput(selector: string): HTMLInputElement {
    const input = container.querySelector(selector);

    expect(input).toBeInstanceOf(HTMLInputElement);

    return input as HTMLInputElement;
  }

  function setInputValue(input: HTMLInputElement, value: string): void {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

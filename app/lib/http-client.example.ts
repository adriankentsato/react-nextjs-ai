import { getApiErrorMessages, httpClient } from './http-client';

interface User {
  id: string;
  name: string;
}

export async function fetchUsersExample(): Promise<User[] | null> {
  try {
    const response = await httpClient.getAllPages<User>('/api/users');
    return response.data;
  } catch (error) {
    const messages = getApiErrorMessages(error);

    // Example output:
    // ['Email is required', 'Name is required']
    console.error('API errors:', messages);
    return null;
  }
}

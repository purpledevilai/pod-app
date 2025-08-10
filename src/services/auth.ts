import { apiClient } from './api';

export async function requestCode(email: string) {
  await apiClient.post('/auth/request-code', { email });
}

export async function verifyCode(email: string, code: string) {
  const { access, refresh, user } =
    (await apiClient.post('/auth/verify-code', { email, code })).data;
  return { access, refresh, user };
}
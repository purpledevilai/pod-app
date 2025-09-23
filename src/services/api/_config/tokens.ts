import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

const KEYS = { 
    access_token: 'access_token',
    refresh_token: 'refresh_token',
}

let ACCESS_TOKEN: string | null = null;
let REFRESH_TOKEN: string | null = null;

export const loadAuthTokens = async () => {
    const [access, refresh] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access_token),
        SecureStore.getItemAsync(KEYS.refresh_token),
    ]);
    ACCESS_TOKEN = access;
    REFRESH_TOKEN = refresh;
}

export const setAuthTokens = async (access_token: string, refresh_token: string) => {
    ACCESS_TOKEN = access_token;
    REFRESH_TOKEN = refresh_token;
    await SecureStore.setItemAsync(KEYS.access_token, ACCESS_TOKEN);
    await SecureStore.setItemAsync(KEYS.refresh_token, REFRESH_TOKEN);
}

export const clearAuthTokens = async () => {
    ACCESS_TOKEN = null;
    REFRESH_TOKEN = null;
    await SecureStore.deleteItemAsync(KEYS.access_token)
    await SecureStore.deleteItemAsync(KEYS.refresh_token)
}

export const getAccessToken = () => ACCESS_TOKEN;
export const getRefreshToken = () => REFRESH_TOKEN;

export const isExpired = (token: string | null): boolean => {
    if (!token) return true;
    try {
        const decoded = jwtDecode<{ exp: number }>(token);
        const now = Math.floor(Date.now() / 1000);
        return decoded.exp < now;
    } catch (error) {
        console.error('Error decoding token:', error);
        return true; // If we can't decode it, consider it expired
    }
};

export const decodeToken = (token: string | null) => {
    if (!token) return null;
    try {
        return jwtDecode(token);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};
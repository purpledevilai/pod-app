import axios from 'axios';
import * as Tokens from './tokens';

// Axios instance
export const apiClient = axios.create({ baseURL: process.env.EXPO_PUBLIC_API });

// Add Bearer token to requests
apiClient.interceptors.request.use((cfg) => {
    const accessToken = Tokens.getAccessToken();
    if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
    return cfg;
});

// Response interceptor to handle 401 errors and refresh token
apiClient.interceptors.response.use(
    r => r,
    async (error) => {
        const refreshToken = Tokens.getRefreshToken();
        if (error.response?.status === 401 && refreshToken) {
            // Do some refresh logic
        }
        // Otherwise just rethrow
        throw error;
    }
);


import axios from 'axios';

// Extend AxiosRequestConfig to include our custom is_public flag
declare module 'axios' {
    interface AxiosRequestConfig {
        is_public?: boolean;
    }
}

// Axios instance
export const apiClient = axios.create({ baseURL: process.env.EXPO_PUBLIC_API });

// Add Bearer token to requests (only for non-public requests)
apiClient.interceptors.request.use(async (cfg) => {
    // Skip auth for public endpoints
    if (cfg.is_public) {
        return cfg;
    }

    // For protected endpoints, we'll get the access token from the auth store
    const { rootStore } = await import('@/src/stores/root-store');
    const accessToken = await rootStore.authStore.getAccessToken();
    if (accessToken) {
        cfg.headers.Authorization = `Bearer ${accessToken}`;
    }
    return cfg;
});

export const ajentifyApiClient = axios.create({ baseURL: process.env.EXPO_PUBLIC_AGENTIFY_API || 'https://api.ajentify.com' });


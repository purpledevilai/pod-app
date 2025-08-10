import axios from 'axios';

let tokens: { access?: string; refresh?: string } = {};
let refreshing: Promise<string> | null = null;

export const apiClient = axios.create({ baseURL: process.env.EXPO_PUBLIC_API });

export function setAuthTokens(t: { access: string; refresh: string }) { tokens = t; }
export function clearAuthTokens() { tokens = {}; }

apiClient.interceptors.request.use((cfg) => {
    if (tokens.access) cfg.headers.Authorization = `Bearer ${tokens.access}`;
    return cfg;
});

apiClient.interceptors.response.use(
    r => r,
    async (error) => {
        const { response, config } = error;
        if (response?.status === 401 && tokens.refresh && !config._retry) {
            config._retry = true;
            try {
                const newAccess = await refreshOnce(tokens.refresh);
                setAuthTokens({ access: newAccess, refresh: tokens.refresh! });
                config.headers.Authorization = `Bearer ${newAccess}`;
                return apiClient(config);
            } catch {
                clearAuthTokens();
            }
        }
        throw error;
    }
);

async function refreshOnce(refresh: string): Promise<string> {
    if (!refreshing) {
        refreshing = apiClient.post('/auth/refresh', { refresh })
            .then(r => r.data.access)
            .finally(() => { refreshing = null; });
    }
    return refreshing;
}

// convenience
export const api = {
    me: async () => (await apiClient.get('/me')).data,
};
export const refreshAccessToken = async (refresh: string) =>
    (await apiClient.post('/auth/refresh', { refresh })).data.access;

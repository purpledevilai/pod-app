import { apiClient } from "../_config/apiclient";

export interface RefreshTokenRequest {
    refresh_token: string;
}

export interface RefreshTokenResponse {
    access_token: string;
    refresh_token: string;
}

export async function refreshToken(params: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const res = await apiClient.post('/refresh-token', { ...params }, { is_public: true });
    return res.data as RefreshTokenResponse;
}

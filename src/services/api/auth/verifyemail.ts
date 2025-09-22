import { apiClient } from "../_config/apiclient";

export interface VerifyEmailRequest {
    challenge_id: string;
    answer: string;
}

export interface VerifyEmailResponse {
    success: boolean;
    message: string;
    create_account_token: string | null;
    access_token: string | null;
    refresh_token: string | null;
}

export async function verifyEmail(params: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    const res = await apiClient.post('/verify-email', { ...params });
    return res.data as VerifyEmailResponse;
}
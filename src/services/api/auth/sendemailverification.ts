import { apiClient } from "../_config/apiclient";

export interface SendEmailVerificationRequest {
    email: string;
}

export interface SendEmailVerificationResponse {
    challenge_id: string;
}

export async function sendEmailVerification(params: SendEmailVerificationRequest): Promise<SendEmailVerificationResponse> {
    const res = await apiClient.post('/send-email-verification', { ...params });
    return res.data as SendEmailVerificationResponse;
}
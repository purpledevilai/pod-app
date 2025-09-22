import { apiClient } from "../_config/apiclient";
import { User } from "../types/user";

export interface CreateAccountRequest {
    create_account_token: string;
    council_id: string;
    bin_system_id: string;
}

export interface CreateAccountResponse {
    user: User;
    access_token: string;
    refresh_token: string;
}

export async function createAccount(params: CreateAccountRequest): Promise<CreateAccountResponse> {
    const res = await apiClient.post('/create-account', { ...params });
    return res.data as CreateAccountResponse;
}

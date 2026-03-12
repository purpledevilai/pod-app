import { apiClient } from '../_config/apiclient';
import { UserResolved } from '../types/user';

export interface UpdateUserRequest {
    council_id?: string;
    bin_system_id?: string;
    pod_configuration?: string;
}

export async function updateUser(params: UpdateUserRequest): Promise<UserResolved> {
    const response = await apiClient.patch('/user', params);
    return response.data as UserResolved;
}

import { apiClient } from "../_config/apiclient";

export interface CreateAgentContextResponse {
    context_id: string;
    client_api_key: string;
}

/**
 * Create a new agent context via the pod-backend.
 * The backend creates the Ajentify context using the server-side API key
 * and returns a short-lived client API key for the frontend to use.
 */
export async function createAgentContext(): Promise<CreateAgentContextResponse> {
    try {
        const response = await apiClient.post('/create-agent-context');
        const data = response.data as CreateAgentContextResponse;

        console.log('[createAgentContext#####################################################] Context created:', data.context_id);

        return data;
    } catch (error) {
        const errorMessage = (error as Error).message || 'An unknown error occurred creating the context';
        console.error('[createAgentContext] Error:', errorMessage);
        throw new Error(errorMessage);
    }
}


import { ajentifyApiClient } from "../_config/apiclient";
import { Context } from "../types/context";

export interface CreateContextRequest {
    agent_id: string;
    invoke_agent_message?: boolean;
    prompt_args?: Record<string, string>;
}

/**
 * Create a new context (conversation session) with an agent
 * This context ID will be used as the room ID for WebRTC
 */
export async function createContext({
    agent_id,
    invoke_agent_message = false,
    prompt_args = {}
}: CreateContextRequest): Promise<Context> {
    try {
        const response = await ajentifyApiClient.post(
            '/context',
            {
                agent_id,
                invoke_agent_message,
                prompt_args
            },
            {
                // Context creation requires authentication
                is_public: false
            }
        );
        
        return response.data as Context;
    } catch (error) {
        const errorMessage = (error as Error).message || 'An unknown error occurred creating the context';
        console.error('[createContext] Error:', errorMessage);
        throw new Error(errorMessage);
    }
}

/**
 * Create a context using the default agent from environment config
 * Convenience method for this app's single-agent setup
 */
export async function createDefaultAgentContext(prompt_args: Record<string, string>): Promise<Context> {
    const agentId = process.env.EXPO_PUBLIC_AGENT_ID || 'default-agent-id';
    console.log('[createDefaultAgentContext] Ajentify API URL:', process.env.EXPO_PUBLIC_AGENTIFY_API);
    console.log('[createDefaultAgentContext] Creating context with agent ID:', agentId);
    return createContext({
        agent_id: agentId,
        prompt_args
    });
}


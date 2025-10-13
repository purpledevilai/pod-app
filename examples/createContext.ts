import { getAccessToken } from "../_config/auth";
import { BASE_URL } from "../_config/constants";
import { checkResponseAndGetJson } from "../_utils/checkResponseAndParseJson";
import { Context } from "../_types/context";

export interface CreateContextPayload {
    agent_id: string;
    invoke_agent_message?: boolean
    prompt_args?: Record<string, string>;
}

export async function createContext({agent_id, invoke_agent_message = false, prompt_args = {}}: CreateContextPayload): Promise<Context> {
  try {
    const response = await fetch(`${BASE_URL}/context`, {
        method: 'POST',
        headers: {
            'Authorization': await getAccessToken() || '',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({agent_id, invoke_agent_message, prompt_args}),
    });
    return await checkResponseAndGetJson(response) as unknown as Context;
  } catch (error) {
    const errorMessage = (error as Error).message || 'An unknown error occurred creating the context';
    throw Error(errorMessage);
  }
}
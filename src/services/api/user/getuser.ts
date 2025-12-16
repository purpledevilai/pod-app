import { apiClient } from '../_config/apiclient';
import { UserResolved } from '../types/user';

/**
 * Fetch the current user from the server using the stored auth token
 * @returns Promise<UserResolved> - The resolved user object with populated council and bin_system
 */
export const getCurrentUser = async (): Promise<UserResolved> => {
  try {
    console.log('[getCurrentUser] Fetching user data...');
    
    const response = await apiClient.get('/user');
    
    if (!response.data) {
      throw new Error('No user data received from server');
    }
    
    console.log('[getCurrentUser] User fetched successfully:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[getCurrentUser] Error fetching user:', error);
    throw error;
  }
};

import { makeAutoObservable, runInAction } from 'mobx';
import { clearAuthTokens, getAccessToken, getRefreshToken, isExpired, loadAuthTokens, setAuthTokens } from '../services/api/_config/tokens';
import { refreshToken } from '../services/api/auth/refreshtoken';
import { sendEmailVerification } from '../services/api/auth/sendemailverification';
import { verifyEmail } from '../services/api/auth/verifyemail';
import { UserResolved } from '../services/api/types/user';
import { getCurrentUser } from '../services/api/user/getuser';

export class AuthStore {
    bootstrapped = false;
    email: string | null = null;
    challengeId: string | null = null;
    createAccountToken: string | null = null;
    isLoggedIn: boolean = false;
    user: UserResolved | null = null;
    private refreshingPromise: Promise<void> | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    async fetchUser() {
        try {
            console.log('[AuthStore] Fetching user data...');
            const user = await getCurrentUser();
            runInAction(() => {
                this.user = user;
            });
            console.log('[AuthStore] User fetched successfully:', user);
        } catch (error) {
            console.error('[AuthStore] Error fetching user:', error);
            // Don't throw - user fetch failure shouldn't break the auth flow
        }
    }

    async bootstrap() {
        console.log("AuthStore: Bootstrapping...");
        await loadAuthTokens();
        
        const accessToken = getAccessToken();
        const refreshTokenValue = getRefreshToken();
        
        console.log("AuthStore: Loaded tokens. Access token exists:", !!accessToken, "Refresh token exists:", !!refreshTokenValue);
        
        if (!accessToken || !refreshTokenValue) {
            console.log("AuthStore: No tokens found, user needs to authenticate");
            runInAction(() => { this.isLoggedIn = false; });
            runInAction(() => { this.bootstrapped = true; });
            return;
        }
        
        // Check if access token is expired
        if (!isExpired(accessToken)) {
            console.log("AuthStore: Access token is valid, user is logged in");
            runInAction(() => { this.isLoggedIn = true; });
            // Fetch user data for existing logged-in user
            await this.fetchUser();
            runInAction(() => { this.bootstrapped = true; });
            return;
        }
        
        // Access token is expired, check refresh token
        if (isExpired(refreshTokenValue)) {
            console.log("AuthStore: Both tokens expired, user needs to re-authenticate");
            await clearAuthTokens();
            runInAction(() => { this.isLoggedIn = false; });
            runInAction(() => { this.bootstrapped = true; });
            return;
        }
        
        // Refresh token is valid, try to refresh access token
        console.log("AuthStore: Access token expired, attempting to refresh...");
        try {
            await this.refreshAccessToken();
            console.log("AuthStore: Successfully refreshed access token");
            runInAction(() => { this.isLoggedIn = true; });
            // Fetch user data after successful token refresh
            await this.fetchUser();
        } catch (error) {
            console.log("AuthStore: Failed to refresh access token:", error);
            await clearAuthTokens();
            runInAction(() => { this.isLoggedIn = false; });
        }
        
        runInAction(() => { this.bootstrapped = true; });
    }

    async sendEmailVerification(email: string) {
        const res = await sendEmailVerification({ email });
        runInAction(() => { 
            this.challengeId = res.challenge_id;
            this.email = email;
            this.createAccountToken = null;
        });
    }

    async verifyCode(code: string) {
        try {
            if (!this.challengeId) throw new Error('No challengeId. Call sendEmailVerification() first.');

            // Call the verifyEmail API
            const res = await verifyEmail({
                challenge_id: this.challengeId,
                answer: code,
            });

            // If access and refresh tokens are returned, they are an existing user
            if (res.access_token && res.refresh_token) {
                await setAuthTokens(res.access_token, res.refresh_token);
                runInAction(() => {
                    this.isLoggedIn = true;
                    this.challengeId = null;
                    this.createAccountToken = null;
                });
                // Fetch user data for existing user
                await this.fetchUser();
                return { status: 'logged_in' as const };
            }

            // If create account token is returned they need to create an account 
            if (res.create_account_token) {
                runInAction(() => { this.createAccountToken = res.create_account_token; });
                return { status: 'needs_account' as const };
            }

            throw new Error(res.message || 'Invalid code, try again.');
        } catch (error) {
            return { status: 'error' as const, message: (error as Error).message};
        }
    }

    async refreshAccessToken() {
        const refreshTokenValue = getRefreshToken();
        if (!refreshTokenValue) {
            throw new Error('No refresh token available');
        }

        const response = await refreshToken({ refresh_token: refreshTokenValue });
        await setAuthTokens(response.access_token, response.refresh_token);
    }

    async loginWithTokens(accessToken: string, refreshToken: string) {
        console.log('[AuthStore] Logging in with tokens...');
        await setAuthTokens(accessToken, refreshToken);
        runInAction(() => {
            this.isLoggedIn = true;
        });
    }

    async logout() {
        console.log("AuthStore: Logging out...");
        await clearAuthTokens();
        runInAction(() => { 
            this.isLoggedIn = false;
            this.user = null;
        });
    }

    async getAccessToken(): Promise<string | null> {
        const currentAccessToken = getAccessToken();

        // If we have a non-expired access token, return it immediately
        if (currentAccessToken && !isExpired(currentAccessToken)) {
            return currentAccessToken;
        }

        // Access token missing or expired. If refresh token is invalid/expired, log out.
        const refreshTokenValue = getRefreshToken();
        if (!refreshTokenValue || isExpired(refreshTokenValue)) {
            await clearAuthTokens();
            runInAction(() => { this.isLoggedIn = false; });
            return null;
        }

        // Deduplicate concurrent refreshes
        if (!this.refreshingPromise) {
            this.refreshingPromise = (async () => {
                await this.refreshAccessToken();
            })().finally(() => {
                this.refreshingPromise = null;
            });
        }

        try {
            await this.refreshingPromise;
        } catch (e) {
            // Refresh failed — clear tokens and set logged out
            await clearAuthTokens();
            runInAction(() => { this.isLoggedIn = false; });
            return null;
        }

        // Return the freshly stored access token (if any)
        const newAccessToken = getAccessToken();
        return newAccessToken && !isExpired(newAccessToken) ? newAccessToken : null;
    }
}

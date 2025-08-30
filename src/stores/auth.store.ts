import { makeAutoObservable, runInAction } from 'mobx';
import { getRefreshToken, loadAuthTokens, setAuthTokens } from '../services/api/_config/tokens';
import { sendEmailVerification } from '../services/api/auth/sendemailverification';
import { verifyEmail } from '../services/api/auth/verifyemail';

export class AuthStore {
    bootstrapped = false;
    email: string | null = null;
    challengeId: string | null = null;
    createAccountToken: string | null = null;
    isLoggedIn: boolean = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    async bootstrap() {
        console.log("AuthStore: Bootstrapping...");
        await loadAuthTokens();
        console.log("AuthStore: Loaded tokens. Refreshtoken:", getRefreshToken());
        if (getRefreshToken()) {
            runInAction(() => { this.isLoggedIn = true; });
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
            if (res.auth_token && res.refresh_token) {
                await setAuthTokens(res.auth_token, res.refresh_token);
                runInAction(() => {
                    this.isLoggedIn = true;
                    this.challengeId = null;
                    this.createAccountToken = null;
                });
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
}

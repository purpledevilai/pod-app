import { api, apiClient, clearAuthTokens, refreshAccessToken, setAuthTokens } from '@/src/services/api';
import * as SecureStore from 'expo-secure-store';
import { makeAutoObservable, runInAction } from 'mobx';

type Session = { userId: string; email: string } | null;
const KEYS = { access: 'pod_access', refresh: 'pod_refresh' };

export class AuthStore {
    // observable state
    session: Session = null;
    verifyingEmail: string | null = null;
    bootstrapped = false;
    challengeId: string | null = null;
    createAccountToken: string | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    // kick off on app start
    async bootstrap() {
        try {
            const [access, refresh] = await Promise.all([
                SecureStore.getItemAsync(KEYS.access),
                SecureStore.getItemAsync(KEYS.refresh),
            ]);

            if (access && refresh) {
                setAuthTokens({ access, refresh });
                try {
                    const newAccess = await refreshAccessToken(refresh);
                    setAuthTokens({ access: newAccess, refresh });
                    await SecureStore.setItemAsync(KEYS.access, newAccess);
                    const me = await api.me();
                    runInAction(() => { this.session = me; });
                } catch {
                    await this.signOut(); // clears tokens if refresh fails
                }
            }
        } finally {
            runInAction(() => { this.bootstrapped = true; });
        }
    }

    // Phase A: send email → get challenge
    async requestCode(email: string) {
        runInAction(() => { this.verifyingEmail = email; });
        const res = await apiClient.post('/send-email-verification', { email });
        runInAction(() => { this.challengeId = res.data.challenge_id; });
        return res.data.challenge_id as string;
    }

    // Phase B: verify code → either login or get createAccountToken
    async verifyCode(code: string) {
        if (!this.challengeId) throw new Error('No challengeId. Call requestCode() first.');

        const res = await apiClient.post('/verify-email', {
            challenge_id: this.challengeId,
            answer: code,
        });

        // existing user → tokens
        if (res.data.auth_token && res.data.refresh_token) {
            const { auth_token, refresh_token } = res.data;
            setAuthTokens({ access: auth_token, refresh: refresh_token });
            await SecureStore.setItemAsync(KEYS.access, auth_token);
            await SecureStore.setItemAsync(KEYS.refresh, refresh_token);
            const me = await api.me();
            runInAction(() => {
                this.session = me;
                this.challengeId = null;
                this.createAccountToken = null;
            });
            return { status: 'logged_in' as const };
        }

        // new user → needs account
        if (res.data.create_account_token) {
            runInAction(() => { this.createAccountToken = res.data.create_account_token; });
            return { status: 'needs_account' as const };
        }

        return { status: 'error' as const, message: res.data.message as string };
    }

    // Phase C: create account using token
    async createAccount(payload: { name: string; password: string }) {
        if (!this.createAccountToken) throw new Error('No createAccountToken.');

        const res = await apiClient.post('/create-account', {
            ...payload,
            token: this.createAccountToken,
        });

        const { auth_token, refresh_token } = res.data;
        setAuthTokens({ access: auth_token, refresh: refresh_token });
        await SecureStore.setItemAsync(KEYS.access, auth_token);
        await SecureStore.setItemAsync(KEYS.refresh, refresh_token);
        const me = await api.me();
        runInAction(() => {
            this.session = me;
            this.createAccountToken = null;
            this.challengeId = null;
        });
    }

    // sign out
    async signOut() {
        clearAuthTokens();
        await Promise.all([
            SecureStore.deleteItemAsync(KEYS.access),
            SecureStore.deleteItemAsync(KEYS.refresh),
        ]);
        runInAction(() => {
            this.session = null;
            this.challengeId = null;
            this.createAccountToken = null;
        });
    }
}

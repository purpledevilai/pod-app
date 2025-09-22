import { setAuthTokens } from '@/src/services/api/_config/tokens';
import { createAccount, CreateAccountResponse } from '@/src/services/api/auth/createaccount';
import { binSystemsForCouncil, BinSystemsForCouncilResponse } from '@/src/services/api/binsystems/binsystemforcouncil';
import { councilsForPostCode, CouncilsForPostcodeResponse } from '@/src/services/api/councils/councilsforpostcode';
import { makeAutoObservable, runInAction } from 'mobx';
import { BinSystem } from '../services/api/types/binsystem';
import { Council } from '../services/api/types/council';
import { User } from '../services/api/types/user';

export class AccountCreationStore {
    email: string | null = null;
    createAccountToken: string | null = null;

    postcode: string | null = null;
    postcodeValid: Boolean = false;
    councilLookUpLoading: Boolean = false;
    councilLookUpError: string | null = null;
    councils: Council[] = [];
    selectedCouncilId: string | null = null;

    binSystemLookUpLoading: boolean = false;
    binSystemLookUpError: string | null = null;
    binSystems: BinSystem[] = [];
    selectedBinSystem: BinSystem | null = null;

    createAccountLoading: boolean = false;
    createAccountError: string | null = null;
    createdUser: User | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    setEmail = (email: string) => {
        runInAction(() => { this.email = email; });
    }

    setPostcode = (postcode: string) => {
        runInAction(() => {
            this.postcodeValid = this.isValidPostcode(postcode)
            this.postcode = postcode;
        });
    }

    private isValidPostcode = (s: string) => {
        // Basic postcode validation - adjust regex based on your requirements
        // This example assumes 4-digit postcodes, modify as needed
        return /^\d{4}$/.test(s.trim());
    }

    lookUpCouncils = async () => {
        try {
            if (!this.postcode) throw new Error("Postcode is not set");
            runInAction(() => { 
                this.councilLookUpError = null;
                this.councilLookUpLoading = true;
                this.councils = [];
            });
            const res: CouncilsForPostcodeResponse = await councilsForPostCode(this.postcode);
            if (res.councils.length === 0) {
                throw new Error("No councils found for this postcode");
            }
            runInAction(() => { this.councils = res.councils; });
            return res.councils;
        } catch (e) {
            console.error("Error looking up councils for postcode:", e);
            runInAction(() => { this.councilLookUpError = 'Could not find councils for this postcode.'; });
            return [];
        } finally {
            runInAction(() => { this.councilLookUpLoading = false; });
        }
    }

    setSelectedCouncil(councilId: string) {
        this.selectedCouncilId = councilId;
    }

    lookUpBinSystem = async () => {
        try {
            if (!this.selectedCouncilId) throw new Error("Council is not selected");
            runInAction(() => { 
                this.binSystemLookUpLoading = true;
                this.selectedBinSystem = null;
                this.binSystemLookUpError = null;
                this.binSystems = [];
            });
            const res: BinSystemsForCouncilResponse = await binSystemsForCouncil(this.selectedCouncilId);
            if (res.bin_systems.length === 0) {
                throw new Error("No bin systems found for this council");
            }
            // Assuming we take the first bin system for simplicity
            runInAction(() => {
                this.binSystems = res.bin_systems; 
                this.selectedBinSystem = res.bin_systems[0]; 
            });
        } catch (e) {
            console.error("Error looking up bin systems for council:", e);
            return null;
        } finally {
            runInAction(() => { this.binSystemLookUpLoading = false; });
        }
    }

    setBinSystem(binSystem: BinSystem) {
        this.selectedBinSystem = binSystem;
    }

    setCreateAccountToken(token: string) {
        this.createAccountToken = token;
    }

    createAccount = async () => {
        try {
            if (!this.createAccountToken || !this.selectedCouncilId || !this.selectedBinSystem) {
                throw new Error("Missing required data for account creation");
            }
            
            runInAction(() => { 
                this.createAccountError = null;
                this.createAccountLoading = true;
            });

            const response: CreateAccountResponse = await createAccount({
                create_account_token: this.createAccountToken,
                council_id: this.selectedCouncilId,
                bin_system_id: this.selectedBinSystem.id
            });

            // Save tokens to secure storage
            await setAuthTokens(response.access_token, response.refresh_token);

            runInAction(() => { 
                this.createdUser = response.user;
            });

            return response.user;
        } catch (e) {
            console.error("Error creating account:", e);
            runInAction(() => { 
                this.createAccountError = 'Failed to create account. Please try again.';
            });
            throw e;
        } finally {
            runInAction(() => { 
                this.createAccountLoading = false;
            });
        }
    }
    
}

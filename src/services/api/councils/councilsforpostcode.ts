import { apiClient } from "../_config/apiclient";
import { Council } from "../types/council";

export interface CouncilsForPostcodeResponse {
    councils: Council[];
}

export async function councilsForPostCode(postcode: string): Promise<CouncilsForPostcodeResponse> {
    const res = await apiClient.get(`/councils-for-postcode/${postcode}`);
    return res.data as CouncilsForPostcodeResponse;
}
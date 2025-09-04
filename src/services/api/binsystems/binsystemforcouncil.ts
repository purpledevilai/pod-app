import { apiClient } from "../_config/apiclient";
import { BinSystem } from "../types/binsystem";

export interface BinSystemsForCouncilResponse {
    bin_systems: BinSystem[];
}

export async function binSystemsForCouncil(councilId: string): Promise<BinSystemsForCouncilResponse> {
    const res = await apiClient.get(`/bin-systems-for-council/${councilId}`);
    return res.data as BinSystemsForCouncilResponse;
}
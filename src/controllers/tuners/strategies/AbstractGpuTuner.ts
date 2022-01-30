import { existsSync, mkdir, mkdirSync, writeFileSync } from 'fs';
import { GpuInfoObject } from '../../../interfaces/IGpuInfo';
import { ISettingFileGpu } from '../../../interfaces/ISettingsFile';

export const POWER_PROFILE_NOT_SET = "idle";

export abstract class AbstractGpuTuner {

    private powerProfile: string;
    

    constructor(protected gpusUserProfiles: ISettingFileGpu) {
        this.setPowerProfile(POWER_PROFILE_NOT_SET);
    }

    public async getInstalledGpus(models: string[]): Promise<GpuInfoObject[]> {
        const result = await this.getInstalledGpus(models);
        return result.map(elm => {
            elm.currentPowerProfile = this.getPowerProfile();
            return elm;
        });
    }

    protected abstract applyGpuPowerSettingsStateless(models: string[]): Promise<string[]>; //returns models where couldn't get the target pwoer profile

    public async applyGpuPowerSettings(models: string[]): Promise<void> {
        const failedModels = await this.applyGpuPowerSettingsStateless(models);
        for (const model of models) {
            if (!existsSync(`/tmp/netter/gpu-power-manager/${model}`)) {
                mkdirSync(`/tmp/netter/gpu-power-manager/${model}`, { recursive: true });
            }
            writeFileSync(`/tmp/netter/gpu-power-manager/${model}/power_profile_status`, failedModels.includes(model) ? POWER_PROFILE_NOT_SET : this.getPowerProfile());
        }
    }

    public setPowerProfile(profileName: string) {
        this.powerProfile = profileName;
    }

    public getPowerProfile() {
        return this.powerProfile;
    }

}
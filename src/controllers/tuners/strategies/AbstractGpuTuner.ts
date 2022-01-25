import { GpuInfoObject } from '../../../interfaces/IGpuInfo';
import { ISettingFileGpu } from '../../../interfaces/ISettingsFile';

export abstract class AbstractGpuTuner {

    protected powerProfile: string;
    
    constructor(protected gpusUserProfiles: ISettingFileGpu) {
        this.powerProfile = "idle";
    }

    public abstract getInstalledGpus(models: string[]): Promise<GpuInfoObject[]>;
    public abstract applyGpuPowerSettings(models: string[]): Promise<void>;
    public setPowerProfile(profileName: string) {
        this.powerProfile = profileName;
    }
    public getPowerProfile() {
        return this.powerProfile;
    }
    
}
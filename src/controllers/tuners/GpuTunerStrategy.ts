import { ISettingFileGpu } from './../../interfaces/ISettingsFile';
import { AbstractGpuTuner } from "./strategies/AbstractGpuTuner";
import { AmdGpuTuner } from './strategies/AmdGpuTuner';
import { NvidiaGpuTuner } from "./strategies/NvidiaGpuTuner";

export class GpuTunerStrategy {
    
    private strategy: AbstractGpuTuner;

    setStrategy(brand: string, configs: ISettingFileGpu): AbstractGpuTuner {
        switch(brand) {
            case "nvidia":
                this.strategy = new NvidiaGpuTuner(configs);
                break;
            case "amd":
                this.strategy = new AmdGpuTuner(configs);
                break;
            default:
                throw new Error("Not supported brand passed: " + brand);
        }
        return this.strategy;
    }
}
import { getInstalledNvidiaGpu } from "./libs/nvidiaGpu";
import { Systeminformation } from "systeminformation";
import { getInstalledAmdGpu } from "./libs/amdGpu";
import { GpuInfoObject, ISettingFile, NetterAmdDeviceName, NetterNvidiaDeviceName } from "./interfaces/ISettingsFile";
import { openSettings } from "./utils/settings";
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { AMD_MODELS_PROPS, NVIDIA_MODELS_PROPS } from "./headers/gpuProps";

interface IGpuStats {
    type: "amd" | "nvidia",
    name: NetterNvidiaDeviceName | NetterAmdDeviceName;
    fanSpeed: number,
    powerDraw: number,
    tempGpu: number,
    tempMem: number,
    powerLimit: number,
    clockCore: number,
    clockMem: number
};

function castAdapterSiData(adapters: Systeminformation.GraphicsControllerData[]): IGpuStats[] {
    return adapters.map((ad) => {
        const castedAdapter = {
            type: null,
            name: ad["netterDeviceName"],
            fanSpeed: ad.fanSpeed,
            tempGpu: ad.temperatureGpu,
            tempMem: ad.temperatureMemory,
            powerDraw: ad.powerDraw,
            powerLimit: ad.powerLimit,
            clockCore: ad.clockCore,
            clockMem: ad.clockMemory
        };
        switch(ad.vendorId)  {
            case AMD_MODELS_PROPS.AMD_VENDOR_ID:
                castedAdapter.type = "amd";
                break;
            case NVIDIA_MODELS_PROPS.NVIDIA_VENDOR_ID:
                castedAdapter.type = "nvidia";
                break;
        }
        return castedAdapter;
    })

}

async function printData(settings: ISettingFile) {
    const result: GpuInfoObject[] = [];
    if (settings.nvidia && Object.keys(settings.nvidia).length > 0) {
        result.push(...await getInstalledNvidiaGpu(Object.keys(settings.nvidia)));
    } 
    if (settings.amd && Object.keys(settings.amd).length > 0) {
        result.push(...await getInstalledAmdGpu(Object.keys(settings.amd)));
    }
    console.table(castAdapterSiData(result));
}

async function main() {
    const settings = openSettings();
    await printData(settings);
    setIntervalAsync(async () => {
        await printData(settings);
    }, 5000);
}

main();
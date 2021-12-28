import { execSync, spawn } from "child_process";
import * as si from 'systeminformation';
import { NVIDIA_MODELS_PROPS } from "../headers/gpuProps";
import { GpuInfoObject, ISettingFile } from "../interfaces/ISettingsFile";
import { debugLog } from "../utils/log";

export const NVIDIA_SUPPORTED_DEVICE_IDS = {};
export const NVIDIA_SUPPORTED_SUBDEVICEVENDOR_IDS = {};

Object.entries(NVIDIA_MODELS_PROPS).forEach(values => {
    if (values[0].includes("SUBDEVICEVENDOR_ID")) {
        Object.assign(NVIDIA_SUPPORTED_SUBDEVICEVENDOR_IDS, { [values[0]]: values[1] })
    } else if (values[0].includes("DEVICE_ID")) {
        Object.assign(NVIDIA_SUPPORTED_DEVICE_IDS, { [values[0]]: values[1] })
    }
}, []);


export const X_DISPLAY_ENV = {
    "DISPLAY": ":0.0"
};

export function execSyncWithEnv(command: string) {
    try {
        const result = execSync(command, {
            env: X_DISPLAY_ENV
        });
        return result;
    } catch (err) {
        console.error("ERROR: command '" + command + "': " + err);
        throw err;
    }
}


export async function getInstalledNvidiaGpu(models: string[]): Promise<GpuInfoObject[]> {
    const gr = await si.graphics();
    debugLog("ALL SYSTEMINFORMATION GRAPHICS ADAPTERS DETECTED: ");
    debugLog(gr);
    const nvidiaCards = gr.controllers.reduce((acc, curr) => {
        try {
            const currentSubVendorId = curr.subDeviceId.indexOf("0x") === 0 ? curr.subDeviceId.toLowerCase().slice(2) : curr.subDeviceId.toLowerCase();
            const subVendorKv = Object.entries(NVIDIA_SUPPORTED_SUBDEVICEVENDOR_IDS).find(values => values[1] === currentSubVendorId);
            const detectedSubVendorId = subVendorKv[1] as string;
            curr.deviceId = NVIDIA_MODELS_PROPS[subVendorKv[0].replace("_SUBDEVICEVENDOR_ID", "") + "_DEVICE_ID"];
            curr["netterDeviceName"] = models.find(model => subVendorKv[0].includes(model));
            const isCompliant = curr.deviceId !== null && detectedSubVendorId !== null;
            curr.vendorId = NVIDIA_MODELS_PROPS.NVIDIA_VENDOR_ID;
            if (isCompliant && curr["netterDeviceName"]) acc.push(curr);
        } catch (err) {
            debugLog("SKIPPING NVIDIA DEVICE - REASON: ");
            debugLog(err);
            debugLog("SKIPPING NVIDIA DEVICE: ");
            debugLog(curr);
        }
        return acc;
    }, []);
    debugLog("NVIDIA GRAPHICS DETECTED: ");
    debugLog(nvidiaCards);
    return nvidiaCards;
}

export async function setupNvidiaPowerSettings(settings: ISettingFile, models: string[]) {
    return new Promise<void>((resolve, reject) => {
        let started = false;
        const xinitproc = spawn("xinit");
        const nvidiaSetup = async (data) => {
            // enter only if xorg says it is started, avoid running this script twice
            if (!started && data.toString().includes(`Using system config directory "/usr/share/X11/xorg.conf.d"`)) {
                started = true;
                console.log("# STARTING SETUP!");
                try {
                    execSyncWithEnv("nvidia-smi -pm 1");
                    const nvidiaGpus = await getInstalledNvidiaGpu(models);
                    console.log("NVIDIA GPUs DETECTED: " + nvidiaGpus.length);

                    for (let i = 0; i < nvidiaGpus.length; i++) {
                        execSyncWithEnv(`nvidia-smi -i ${i} -pl ${settings.nvidia[nvidiaGpus[i].netterDeviceName].power_limit.toString()}`);
                        execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GpuPowerMizerMode=1"`);
                        execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GPUFanControlState=1"`);
                        execSyncWithEnv(`nvidia-settings -a "[fan:${i}]/GPUTargetFanSpeed=${settings.nvidia[nvidiaGpus[i].netterDeviceName].fan_speed.toString()}"`); // WIP: seems that fan index is not corresponing to device index
                        execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GPUGraphicsClockOffsetAllPerformanceLevels=${settings.nvidia[nvidiaGpus[i].netterDeviceName].core_clock_offset.toString()}"`);
                        execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GPUMemoryTransferRateOffsetAllPerformanceLevels=${(settings.nvidia[nvidiaGpus[i].netterDeviceName].ram_clock_offset * 2).toString()}"`);
                    }
                    execSyncWithEnv(`ps -ef | grep /usr/libexec/Xorg | grep -v grep | awk '{print $2}' | xargs kill`);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }
        }
        xinitproc.stderr.on("data", async data => {
            console.log("stderr data: " + data);
            if (data.toString().includes("Server is already active for display 0")) {
                execSync('pkill Xorg');
                process.exit();
            } else {
                await nvidiaSetup(data);
            }
        })
        xinitproc.stdout.on("data", async data => {
            console.log(data);
            await nvidiaSetup(data);

        })
        xinitproc.stderr.once("error", data => {
            console.error("ERROR xinitproc stderr:" + data.toString());
            reject(data);
        })
    })
}

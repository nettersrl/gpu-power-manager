import { execSync, spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import * as si from 'systeminformation';
import { GpuInfoObject } from "../../../interfaces/IGpuInfo";
import { ISettingFileGpu } from "../../../interfaces/ISettingsFile";
import { debugLog } from "../../../utils/log";
import { killProcessAndWaitForEnd } from "../../../utils/processes";
import { AbstractGpuTuner } from "./AbstractGpuTuner";



export class NvidiaGpuTuner extends AbstractGpuTuner {

    private xDisplayEnvVars: NodeJS.ProcessEnv;

    public constructor(nvidiaGpusUserProfiles: ISettingFileGpu) {
        super(nvidiaGpusUserProfiles);
        this.xDisplayEnvVars = {
            "DISPLAY": ":0.0"
        }
    };

    private execSyncWithEnv(command: string) {
        try {
            const result = execSync(command, {
                env: this.xDisplayEnvVars
            });
            return result;
        } catch (err) {
            console.error("ERROR: command '" + command + "': " + err);
            throw err;
        }
    }

    public async getInstalledGpus(models: string[]): Promise<GpuInfoObject[]> {
        const gr = await si.graphics();
        debugLog("[getInstalledNvidiaGpu]: systeminformation found this graphic cards: ");
        debugLog(gr);
        debugLog("----------------------------------------------------------------------");
        const nvidiaCards = gr.controllers.reduce((acc, curr) => {
            try {
                const currentSubVendorId = curr.subDeviceId.indexOf("0x") === 0 ? curr.subDeviceId.toLowerCase().slice(2) : curr.subDeviceId.toLowerCase();
                const currentVendorId = curr.vendorId.indexOf("0x") === 0 ? curr.vendorId.toLowerCase().slice(2) : curr.vendorId.toLowerCase();
                const currentDeviceId = curr.deviceId.indexOf("0x") === 0 ? curr.deviceId.toLowerCase().slice(2) : curr.deviceId.toLowerCase();
                for (const gpuName in this.gpusUserProfiles) {
                    const subVendorDeviceId = this.gpusUserProfiles[gpuName].subsystem_vendor_id + this.gpusUserProfiles[gpuName].subsystem_device_id;
                    if (models.includes(gpuName) &&
                        subVendorDeviceId === currentSubVendorId &&
                        this.gpusUserProfiles[gpuName].vendor_id === currentVendorId &&
                        this.gpusUserProfiles[gpuName].device_id === currentDeviceId
                    ) {
                        curr.deviceId = this.gpusUserProfiles[gpuName].device_id;
                        curr.vendorId = this.gpusUserProfiles[gpuName].vendor_id;
                        curr["netterDeviceName"] = gpuName;
                        curr["vendor"] = "nvidia";
                        acc.push(curr);
                    }
                }
            } catch {
                debugLog("ERROR: missing some informations for gpu " + curr.name);
            }
            return acc;
        }, []);
        debugLog("[getInstalledNvidiaGpu]: overall NVIDIA GRAPHICS DETECTED: ");
        debugLog(nvidiaCards);
        return nvidiaCards;
    }


    public applyGpuPowerSettings(models: string[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let started = false;
            let freeDisplayIndex: number = 1;

            // check if other X sessions are started
            const tmpDirContent = readdirSync("/tmp");
            const getXDisplayIndexRegex = new RegExp("\.X(\d+)-lock");
            const xLocks = tmpDirContent.filter(fileName => getXDisplayIndexRegex.test(fileName)).map(fileName => parseInt(fileName.replace(getXDisplayIndexRegex, "$1")));
            xLocks.every(idx => {
                if (freeDisplayIndex === idx) {
                    freeDisplayIndex = idx + 1;
                    return true;
                }
            });

            const xinitproc = spawn("xinit -- :" + freeDisplayIndex);
            const nvidiaSetup = async (data) => {
                let error: Error;
                // enter only if xorg says it is started, avoid running this script twice
                if (!started && data.toString().includes(`Using system config directory "/usr/share/X11/xorg.conf.d"`)) {
                    started = true;
                    debugLog("[NvidiaSetup]: starting nvidia-settings routine");
                    try {
                        this.execSyncWithEnv("nvidia-smi -pm 1");
                        const nvidiaGpus = await this.getInstalledGpus(models);
                        debugLog("[NvidiaSetup]: Installed nvidia cards detected: " + nvidiaGpus.length + ". Going to process them.");

                        for (let i = 0; i < nvidiaGpus.length; i++) {
                            const powerProfileObject = this.gpusUserProfiles[nvidiaGpus[i].netterDeviceName].powerProfiles[this.powerProfile];
                            if (powerProfileObject) {
                                this.execSyncWithEnv(`nvidia-smi -i ${i} -pl ${powerProfileObject.power_limit.toString()}`);
                                this.execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GpuPowerMizerMode=1"`);
                                this.execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GPUFanControlState=1"`);
                                this.execSyncWithEnv(`nvidia-settings -a "[fan:${i}]/GPUTargetFanSpeed=${powerProfileObject.fan_speed.toString()}"`); // WIP: seems that fan index is not corresponing to device index
                                this.execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GPUGraphicsClockOffsetAllPerformanceLevels=${powerProfileObject.core_clock_offset.toString()}"`);
                                this.execSyncWithEnv(`nvidia-settings -a "[gpu:${i}]/GPUMemoryTransferRateOffsetAllPerformanceLevels=${(powerProfileObject.ram_clock_offset * 2).toString()}"`);
                            } else {
                                console.log(`Skipping cards with this device name: ${nvidiaGpus[i].netterDeviceName} since power profile: ${this.powerProfile} is not configured in settings.json`);
                            }
                        }
                    } catch (err) {
                        error = err;
                    }
                    if (!xinitproc.killed) {
                        const waitForSignal = new Promise<void>((resolveSignal) => {
                            xinitproc.once("exit", () => {
                                resolveSignal();
                            });
                        });
                        xinitproc.kill();
                        await waitForSignal;
                    }
                    if (existsSync("/tmp/.X11-unix/X" + freeDisplayIndex)) {
                        const listOfProcessesUsingXDisplay = execSync("lsof /tmp/.X11-unix/X" + freeDisplayIndex).toString().split("\n");
                        for (const row of listOfProcessesUsingXDisplay.slice(1)) {
                            await killProcessAndWaitForEnd(parseInt(row.trim().split(" ")[1]));
                        }
                    }
                    error ? reject(error) : resolve();
                }
            }
            xinitproc.stderr.on("data", async data => {
                debugLog("stderr data: " + data);
                if (data.toString().includes("Server is already active for display")) {
                    console.error("ERROR: please kill the running X.org server active on display because " + data.toString());
                    process.exit();
                } else {
                    await nvidiaSetup(data);
                }
            })
            xinitproc.stdout.on("data", async data => {
                debugLog(data);
                await nvidiaSetup(data);

            })
            xinitproc.stderr.once("error", data => {
                console.error("ERROR xinitproc stderr:" + data.toString());
                reject(data);
            })
        })
    }
}

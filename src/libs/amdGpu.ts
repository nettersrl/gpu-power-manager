import { NetterNvidiaDeviceName, NetterAmdDeviceName, GpuInfoObject, ISettingFile } from '../interfaces/ISettingsFile';
import { debugLog } from '../utils/log';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { AMD_MODELS_PROPS } from '../headers/gpuProps';
import { execSync } from 'child_process';
import _ from 'lodash';
import { debug } from 'console';

export const AMD_SUPPORTED_DEVICE_IDS = {};
export const AMD_SUPPORTED_SUBDEVICEVENDOR_IDS = {};

Object.entries(AMD_MODELS_PROPS).forEach(values => {
    if (values[0].includes("SUBDEVICEVENDOR_ID")) {
        Object.assign(AMD_SUPPORTED_SUBDEVICEVENDOR_IDS, { [values[0]]: values[1] })
    } else if (values[0].includes("DEVICE_ID")) {
        Object.assign(AMD_SUPPORTED_DEVICE_IDS, { [values[0]]: values[1] })
    }
}, []);


interface IClock {
    index: number,
    frequency: number// in Mhz
    voltage: number // in mV
}

export async function getInstalledAmdGpu(models: string[]): Promise<GpuInfoObject[]> {
    const cards = readdirSync("/sys/class/drm/").reduce((acc: GpuInfoObject[], curr) => {
        if (existsSync(`/sys/class/drm/${curr}/device/vendor`) && existsSync(`/sys/class/drm/${curr}/device/device`)) {
            let foundModelName: string;
            let isCompliant: boolean;
            try {
                const currentDeviceId = readFileSync(`/sys/class/drm/${curr}/device/device`).toString().trim().toLowerCase().slice(2);
                const currentSubVendorId = readFileSync(`/sys/class/drm/${curr}/device/subsystem_vendor`).toString().trim().toLowerCase().slice(2) + readFileSync(`/sys/class/drm/${curr}/device/subsystem_device`).toString().trim().toLowerCase().slice(2);
                const detectedDeviceId = Object.entries(AMD_SUPPORTED_DEVICE_IDS).find(values => values[1] === currentDeviceId)[1] as string;
                const detectedSubVendorKv = Object.entries(AMD_SUPPORTED_SUBDEVICEVENDOR_IDS).find(values => values[1] === currentSubVendorId);
		const detectedSubVendorId = detectedSubVendorKv[1] as string;
                isCompliant = (readFileSync(`/sys/class/drm/${curr}/device/vendor`).toString().trim().toLowerCase().slice(2) === AMD_MODELS_PROPS.AMD_VENDOR_ID) && detectedDeviceId !== null && detectedSubVendorId !== null;
                foundModelName = models.find(model => detectedSubVendorKv[0].includes(model));
                if (isCompliant && foundModelName) {
                    const gpuIndex = curr.slice(4);
                    const hwmonDirName = readdirSync(`/sys/class/drm/card${gpuIndex}/device/hwmon`)[0];
                    const powerLimitInWatt = parseInt(readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/power1_cap`).toString().trim()) / 1000000;
                    const powerDrawInWatt = parseInt(readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/power1_average`).toString().trim()) / 1000000;
                    const fanSpeedInPercentage = Math.round(parseInt(readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/pwm1`).toString().trim()) / 2.55);
                    const pcilinkspeed = `/sys/class/drm/card${gpuIndex}/device/current_link_speed`;
                    const pcilinkwidth = `/sys/class/drm/card${gpuIndex}/device/current_link_width`;
                    const maxpcilinkspeed = `/sys/class/drm/card${gpuIndex}/device/max_link_speed`;
                    const maxpcilinkwidth = `/sys/class/drm/card${gpuIndex}/device/max_link_width`;
                    debugLog("pcilinkspeed: " + pcilinkspeed)
                    debugLog("pcilinkwidth: " + pcilinkwidth)
                    debugLog("maxpcilinkspeed: " + maxpcilinkspeed)
                    debugLog("maxpcilinkwidth: " + maxpcilinkwidth)
                    const temperatureCoreFilename = readdirSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}`).find(filename => filename.startsWith("temp") && filename.endsWith("label") && readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/${filename}`).toString().trim() === "edge");
                    const temperatureMemFilename = readdirSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}`).find(filename => filename.startsWith("temp") && filename.endsWith("label") && readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/${filename}`).toString().trim() === "mem");
                    const temperatureCoreInCelsius = parseInt(readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/${temperatureCoreFilename.replace("label", "input")}`).toString().trim()) / 1000;
                    const temperatureMemInCelsius = parseInt(readFileSync(`/sys/class/drm/card${gpuIndex}/device/hwmon/${hwmonDirName}/${temperatureMemFilename.replace("label", "input")}`).toString().trim()) / 1000;
                    const memoryClocksSupported = readFileSync(`/sys/class/drm/card${gpuIndex}/device/pp_dpm_mclk`).toString().trim();
                    const coreClocksSupported = readFileSync(`/sys/class/drm/card${gpuIndex}/device/pp_dpm_sclk`).toString().trim();
                    const currMemoryClock = parseInt(memoryClocksSupported.split("\n").find(clk => clk.includes("*")).replace(/\d+: +(\d+)Mhz \*/g, "$1"));
                    const currCoreClock = parseInt(coreClocksSupported.split("\n").find(clk => clk.includes("*")).replace(/\d+: +(\d+)Mhz \*/g, "$1"));
                    const gpuObject: GpuInfoObject = {
                        vendor: "amd",
                        vendorId: AMD_MODELS_PROPS.AMD_VENDOR_ID,
                        bus: null,
                        model: null,
                        netterDeviceName: foundModelName as NetterAmdDeviceName | NetterNvidiaDeviceName,
                        vram: null,
                        vramDynamic: null,
                        subDeviceId: "0x" + detectedSubVendorId,
                        fanSpeed: fanSpeedInPercentage,
                        temperatureGpu: temperatureCoreInCelsius,
                        temperatureMemory: temperatureMemInCelsius,
                        powerDraw: powerDrawInWatt,
                        powerLimit: powerLimitInWatt,
                        clockCore: currCoreClock,
                        clockMemory: currMemoryClock,
                        gpuSysfsIndex: gpuIndex
                    };
                    if (gpuObject.netterDeviceName) acc.push(gpuObject);
                }
            } catch (err) {
                debugLog("SKIPPING AMD DEVICE - REASON: ");
                debugLog(err);
                debugLog("SKIPPING AMD DEVICE: ");
                debugLog(curr);
            }
        }
        return acc;
    }, []);

    debugLog("AMD GRAPHICS DETECTED: ");
    debugLog(cards);

    return cards;
}

export async function setupAmdPowerSettings(settings: ISettingFile, models: string[]) {
    const amdgpus = await getInstalledAmdGpu(models);
    for (let i = 0; i < amdgpus.length; i++) {
        const hwmonDirName = readdirSync(`/sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/hwmon`)[0];
        // sets power cap
        execSync(`echo ${settings.amd[amdgpus[i].netterDeviceName].power_limit * 1000000} > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/hwmon/${hwmonDirName}/power1_cap`);
        // enable fan speed control and set fan speed scaling the range to 1-255
        execSync(`echo 1 > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/hwmon/${hwmonDirName}/pwm1_enable`);
        execSync(`echo ${Math.round(settings.amd[amdgpus[i].netterDeviceName].fan_speed * 2.55)} > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/hwmon/${hwmonDirName}/pwm1`);
        execSync(`echo "manual" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/power_dpm_force_performance_level`);
        
        // see https://linuxreviews.org/HOWTO_undervolt_the_AMD_RX_4XX_and_RX_5XX_GPUs
        execSync(`echo "r" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_od_clk_voltage`);
        execSync(`echo "c" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_od_clk_voltage`);
        const coreClocks: IClock[] = []; // OD_SCLK phases
        const memoryClocks: IClock[] = []; // OD_MCLK phases
        let foundMagicHeaderOccurrencies = 0;
        
        for (const line of readFileSync(`/sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_od_clk_voltage`).toString().split("\n")) {
            const upCsdLine = line.toUpperCase();
            const foundClock: IClock = {
                index: undefined,
                frequency: undefined,
                voltage: undefined
            };
            if (upCsdLine.includes("OD_SCLK") || upCsdLine.includes("OD_MCLK")) {
                foundMagicHeaderOccurrencies++;
                continue;
            }
            if (!upCsdLine.includes("MHZ") && foundMagicHeaderOccurrencies === 2) {
                break;
            }
            foundClock.index = parseInt(upCsdLine.slice(0, upCsdLine.indexOf(":")));
            foundClock.frequency = parseInt(upCsdLine.slice(upCsdLine.indexOf(":") + 2, upCsdLine.indexOf("MHZ")));
            // TODO: foundClock.voltage is in "mV"
            if (foundMagicHeaderOccurrencies === 1) {
                coreClocks.push(foundClock);
            } else if (foundMagicHeaderOccurrencies === 2) {
                memoryClocks.push(foundClock);
            }
        }

        debugLog("Found core clocks for AMD before applying: " + JSON.stringify(coreClocks, null, 4));
        debugLog("Found memory clocks for AMD before applying: " + JSON.stringify(memoryClocks, null, 4));

        const highestCoreFreq = _.cloneDeep(coreClocks[coreClocks.length - 1]);
        const highestMemFreq = _.cloneDeep(memoryClocks[coreClocks.length - 1]);
        const newCoreFreq = highestCoreFreq.frequency + settings.amd[amdgpus[i].netterDeviceName].core_clock_offset;
        const newMemFreq = highestMemFreq.frequency + settings.amd[amdgpus[i].netterDeviceName].ram_clock_offset;
        execSync(`echo "${highestCoreFreq.index}" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_dpm_sclk`);
        execSync(`echo "s ${highestCoreFreq.index} ${newCoreFreq}" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_od_clk_voltage`);
        execSync(`echo "m ${highestMemFreq.index} ${newMemFreq}" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_od_clk_voltage`);
        execSync(`echo "c" > /sys/class/drm/card${amdgpus[i].gpuSysfsIndex}/device/pp_od_clk_voltage`);
    }
}

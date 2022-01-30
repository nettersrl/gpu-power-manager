import { execSync } from "child_process";

function nvidiaSmi() {
    const nvidiaSmiExe = 'nvidia-smi';
    const nvidiaSmiOpts = '--query-gpu=driver_version,pci.sub_device_id,name,pci.bus_id,fan.speed,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu,temperature.memory,power.draw,power.limit,clocks.gr,clocks.mem --format=csv,noheader,nounits';
    const cmd = nvidiaSmiExe + ' ' + nvidiaSmiOpts + '  2>/dev/null';
    const res = execSync(cmd).toString();
    return res;
}

export function scanNvidiaDevices() {

    function safeParseNumber(value) {
        if ([null, undefined].includes(value)) {
            return value;
        }
        return parseFloat(value);
    }

    const stdout = nvidiaSmi();
    if (!stdout) {
        return [];
    }

    const gpus = stdout.split('\n').filter(Boolean);
    const results = gpus.map(gpu => {
        const splittedData = gpu.split(', ').map(value => value.includes('N/A') ? undefined : value);
        if (splittedData.length === 16) {
            return {
                driverVersion: splittedData[0],
                subDeviceId: splittedData[1],
                name: splittedData[2],
                pciBus: splittedData[3],
                fanSpeed: safeParseNumber(splittedData[4]),
                memoryTotal: safeParseNumber(splittedData[5]),
                memoryUsed: safeParseNumber(splittedData[6]),
                memoryFree: safeParseNumber(splittedData[7]),
                utilizationGpu: safeParseNumber(splittedData[8]),
                utilizationMemory: safeParseNumber(splittedData[9]),
                temperatureGpu: safeParseNumber(splittedData[10]),
                temperatureMemory: safeParseNumber(splittedData[11]),
                powerDraw: safeParseNumber(splittedData[12]),
                powerLimit: safeParseNumber(splittedData[13]),
                clockCore: safeParseNumber(splittedData[14]),
                clockMemory: safeParseNumber(splittedData[15]),
            };
        }
    });

    return results;
}
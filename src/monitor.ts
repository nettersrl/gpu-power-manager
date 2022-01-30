import { Table } from 'console-table-printer';
import { existsSync, readFileSync } from 'fs';
import _ from 'lodash';
import { clearIntervalAsync, setIntervalAsync } from 'set-interval-async/dynamic';
import { Systeminformation } from "systeminformation";
import { GpuTunerStrategy } from './controllers/tuners/GpuTunerStrategy';
import { POWER_PROFILE_NOT_SET } from './controllers/tuners/strategies/AbstractGpuTuner';
import { GpuInfoObject } from './interfaces/IGpuInfo';
import { ISettingFile } from "./interfaces/ISettingsFile";
import { openSettings } from "./utils/settings";
import chokidar from 'chokidar';

const relevantChange: IGpuNumericStats = {
    fanSpeed: 5,
    clockCore: 500,
    clockMem: 50,
    powerDraw: 100,
    powerLimit: 100,
    tempGpu: 5,
    tempMem: 5
};

interface IGpuNumericStats {
    fanSpeed: number;
    powerDraw: number;
    tempGpu: number;
    tempMem: number;
    powerLimit: number;
    clockCore: number;
    clockMem: number;
}

interface IGpuStats extends IGpuNumericStats {
    index: number;
    profile: string;
    type: string;
    name: string;
}

class GpuStatsData {
    private data: IGpuStats;
    private isEmpty: boolean;
    constructor() {
        this.data = {
            index: null,
            type: null,
            name: null,
            profile: null,
            fanSpeed: 0,
            powerDraw: 0,
            tempGpu: 0,
            tempMem: 0,
            powerLimit: 0,
            clockCore: 0,
            clockMem: 0
        };
        this.isEmpty = true;
    }

    setData(data: IGpuStats) {
        this.data = data;
        this.isEmpty = false;
    }

    getData() {
        return this.data;
    }

    isEmptyData() {
        return this.isEmpty;
    }
}


class GpuStatsArchiver {
    private previousRecord: GpuStatsData;
    private currentRecord: GpuStatsData;
    private powerProfile: string;
    private listener: chokidar.FSWatcher;

    constructor() {
        this.previousRecord = new GpuStatsData();
        this.currentRecord = new GpuStatsData();
        this.powerProfile = POWER_PROFILE_NOT_SET;
    }

    getPowerProfileStatus() {
        return this.powerProfile;
    }

    readPowerProfileStatus() {
        if (existsSync(`/tmp/netter/gpu-power-manager/${this.currentRecord.getData().name}/power_profile_status`)) {
            this.powerProfile = readFileSync(`/tmp/netter/gpu-power-manager/${this.currentRecord.getData().name}/power_profile_status`).toString().trim();
            if(!this.listener) {
                this.listenForChanges();
            }
        }
    }

    private listenForChanges() {
        this.listener = chokidar.watch(`/tmp/netter/gpu-power-manager/${this.currentRecord.getData().name}/power_profile_status`);
        this.listener.on('all', () => {
            this.powerProfile = readFileSync(`/tmp/netter/gpu-power-manager/${this.currentRecord.getData().name}/power_profile_status`).toString().trim();
        });
    }

    setCurrentRecord(record: IGpuStats) {
        this.previousRecord = this.currentRecord;
        this.currentRecord = new GpuStatsData();
        this.currentRecord.setData(record);
    }

    getCurrentRecord() {
        return this.currentRecord;
    }

    getPreviousRecord() {
        return this.previousRecord;
    }

    getDifferences(): IGpuNumericStats {
        return {
            fanSpeed: this.currentRecord.getData().fanSpeed - this.previousRecord.getData().fanSpeed,
            powerDraw: this.currentRecord.getData().powerDraw - this.previousRecord.getData().powerDraw,
            tempGpu: this.currentRecord.getData().tempGpu - this.previousRecord.getData().tempGpu,
            tempMem: this.currentRecord.getData().tempMem - this.previousRecord.getData().tempMem,
            powerLimit: this.currentRecord.getData().powerLimit - this.previousRecord.getData().powerLimit,
            clockCore: this.currentRecord.getData().clockCore - this.previousRecord.getData().clockCore,
            clockMem: this.currentRecord.getData().clockMem - this.previousRecord.getData().clockMem
        }
    }

    checkCriticalValuesAreTooHigh(): boolean {
        switch (this.powerProfile) {
            case "mining":
                return this.currentRecord.getData().fanSpeed < 50 || this.currentRecord.getData().tempGpu > 70 || this.currentRecord.getData().tempMem > 85 || this.currentRecord.getData().powerDraw < (this.currentRecord.getData().powerLimit - 20);
            case POWER_PROFILE_NOT_SET:
                return ((this.currentRecord.getData().tempGpu > 50 || this.currentRecord.getData().tempMem > 50) && this.currentRecord.getData().fanSpeed < 40) ||
                    ((this.currentRecord.getData().tempGpu > 80 || this.currentRecord.getData().tempMem > 80) && this.currentRecord.getData().fanSpeed > 40);
        }
    }
};

class GpuStatsManager {
    private static instance: GpuStatsManager;
    private stats: GpuStatsArchiver[];
    private constructor() {
        this.stats = [];
    }
    public static getInstance() {
        if (!this.instance) {
            this.instance = new GpuStatsManager();
        }
        return this.instance;
    }
    public getStatsArray() {
        return this.stats;
    }
}

function castAdapterSiData(adapters: Array<Systeminformation.GraphicsControllerData & { vendor: string; netterDeviceName: string }>): GpuStatsArchiver[] {
    return adapters.map((ad, idx) => {
        let currentAdapter = GpuStatsManager.getInstance().getStatsArray().find(stat => stat.getCurrentRecord().getData().index === idx);
        const castedAdapter: IGpuStats = {
            index: idx,
            profile: null,
            type: ad.vendor,
            name: ad.netterDeviceName,
            fanSpeed: ad.fanSpeed,
            tempGpu: ad.temperatureGpu,
            tempMem: ad.temperatureMemory,
            powerDraw: ad.powerDraw,
            powerLimit: ad.powerLimit,
            clockCore: ad.clockCore,
            clockMem: ad.clockMemory
        }
        for (const key in castedAdapter) {
            if (castedAdapter[key] == null) {
                castedAdapter[key] = "NA";
            }
        }
        if (!currentAdapter) {
            currentAdapter = new GpuStatsArchiver();
            currentAdapter.setCurrentRecord(castedAdapter);
            GpuStatsManager.getInstance().getStatsArray().push(currentAdapter);
        } else {
            currentAdapter.setCurrentRecord(castedAdapter);
        }
        currentAdapter.readPowerProfileStatus();
        castedAdapter.profile = currentAdapter.getPowerProfileStatus();
        return currentAdapter;
    })

}

async function printData(settings: ISettingFile, isFirstRun?: boolean) {
    const result: GpuInfoObject[] = [];
    for (const brand of Object.keys(settings)) {
        if (Object.keys(settings[brand]).length > 0) {
            result.push(...await new GpuTunerStrategy().setStrategy(brand, settings[brand]).getInstalledGpus(Object.keys(settings[brand])));
        }
    }
    if (!result || result.length === 0) {
        throw new Error("No GPU detected.");
    }
    console.clear();
    const dataToPrint = castAdapterSiData(result);
    const date = new Date();
    const p = new Table({ title: `GPU stats (Last update at: ${date.toTimeString().split(' ')[0]})` });
    for (const elmToPrint of dataToPrint) {
        const row = { color: "white" };
        const differences = elmToPrint.getDifferences();
        const data = _.cloneDeep(elmToPrint.getCurrentRecord().getData());

        if (elmToPrint.checkCriticalValuesAreTooHigh()) {
            row.color = "red";
        } else {
            let emergency = false;
            for (const key in differences) {
                if (typeof differences[key] === "number" && !isNaN(differences[key]) && Math.round(differences[key]) !== 0 && !isFirstRun) {
                    data[key] += `${Math.abs(differences[key]) > relevantChange[key] ? " !" : " "}(${differences[key] > 0 ? "+" : ""}${Math.trunc(differences[key])})`;
                    if (emergency === false) {
                        if (differences[key] > relevantChange[key]) {
                            row.color = "red";
                            emergency = true;
                        } else if (row.color !== "yellow" && differences[key] < -relevantChange[key]) {
                            row.color = "green";
                        } else if (row.color === "green" && differences[key] > 0) {
                            row.color = "yellow";
                        }
                    }
                }
            }
        }
        p.addRow(data, row);
    }
    p.printTable();
}

async function main() {
    const settings = openSettings();
    await printData(settings, true);
    setIntervalAsync(async () => {
        await printData(settings);
    }, 5000);
}

main().catch(console.error);
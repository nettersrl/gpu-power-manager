import { Table } from 'console-table-printer';
import _ from 'lodash';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { Systeminformation } from "systeminformation";
import { GpuTunerStrategy } from './controllers/tuners/GpuTunerStrategy';
import { GpuInfoObject } from './interfaces/IGpuInfo';
import { ISettingFile } from "./interfaces/ISettingsFile";
import { openSettings } from "./utils/settings";

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

    constructor() {
        this.previousRecord = new GpuStatsData();
        this.currentRecord = new GpuStatsData();
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
        return this.currentRecord.getData().fanSpeed < 50 || this.currentRecord.getData().tempGpu > 70 || this.currentRecord.getData().tempMem > 85 || this.currentRecord.getData().powerDraw < (this.currentRecord.getData().powerLimit - 20);
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
        if (!currentAdapter) {
            currentAdapter = new GpuStatsArchiver();
            currentAdapter.setCurrentRecord(castedAdapter);
            GpuStatsManager.getInstance().getStatsArray().push(currentAdapter);
        } else {
            currentAdapter.setCurrentRecord(castedAdapter);
        }
        return currentAdapter;
    })

}

async function printData(settings: ISettingFile, isFirstRun?: boolean) {
    const result: GpuInfoObject[] = [];
    for (const brand of Object.keys(settings)) {
        if (Object.keys(settings[brand]).length > 0 && process.env[brand.toUpperCase()] !== "false") {
            result.push(...await new GpuTunerStrategy().setStrategy(brand, settings[brand]).getInstalledGpus(Object.keys(settings[brand])));
        }
    }
    if (!result || result.length === 0) {
        throw new Error("No GPU detected.");
    }
    console.clear();
    const dataToPrint = castAdapterSiData(result);
    const p = new Table({ title: 'GPU stats' });
    for (const elmToPrint of dataToPrint) {
        const row = { color: "white" };
        const differences = elmToPrint.getDifferences();
        const data = _.cloneDeep(elmToPrint.getCurrentRecord().getData());
        const relevantChange = 5;
        if (elmToPrint.checkCriticalValuesAreTooHigh()) {
            row.color = "red";
        } else {
            let emergency = false;
            for (const key in differences) {
                if (differences[key] !== 0 && !isFirstRun) {
                    data[key] += `${Math.abs(differences[key]) > relevantChange ? " !" : " "}(${differences[key] > 0 ? "+" : ""}${differences[key]})`;
                    if (emergency === false) {
                        if (differences[key] > relevantChange) {
                            row.color = "red";
                            emergency = true;
                        } else if (row.color !== "white_bold" && differences[key] < 0) {
                            row.color = "green";
                        } else if (row.color === "green" && differences[key] > 0 && Math.abs(differences[key]) < relevantChange) {
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
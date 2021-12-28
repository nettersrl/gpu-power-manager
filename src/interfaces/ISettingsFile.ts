import si from 'systeminformation';

export interface IGpuSettingProps {
    "fan_speed": number;
    "core_clock_offset": number;
    "ram_clock_offset": number;
    "power_limit": number;
};

export interface ISettingFile {
    "nvidia": {
        "ZOTAC_RTX_3070": IGpuSettingProps;
        "MSI_RTX_2080_SUPER": IGpuSettingProps;
    };
    "amd": {
        "ASROCK_RX_6800_XT": IGpuSettingProps;
        "SAPPHIRE_RX_6800": IGpuSettingProps;
        "GIGABYTE_RX_5700_XT": IGpuSettingProps;
    };
};

export type NetterNvidiaDeviceName = "ZOTAC_RTX_3070" | "MSI_RTX_2080_SUPER";
export type NetterAmdDeviceName = "ASROCK_RX_6800_XT" | "SAPPHIRE_RX_6800" | "GIGABYTE_RX_5700_XT";

export type GpuInfoObject = si.Systeminformation.GraphicsControllerData & { netterDeviceName: NetterNvidiaDeviceName | NetterAmdDeviceName; gpuSysfsIndex: string };
export interface IPowerProfileProps {
    fan_speed: number;
    core_clock_offset: number;
    ram_clock_offset: number;
    power_limit: number;
}

export interface IGpuSettingProps {
    vendor_id: string;
    device_id: string;
    subsystem_vendor_id: string;
    subsystem_device_id: string;
    powerProfiles: {
        [powerProfileName: string]: IPowerProfileProps; // powerProfileName can be "stock", "vgpu", "mining" or whatsoever
    }
};

export interface ISettingFileGpu {
    [gpuDeviceName: string]: IGpuSettingProps; // gpuDeviceName can be ZOTAC_RTX_3070 or SAPPHIRE_RX_6800
}

export interface ISettingFile {
    [vendorName: string]: ISettingFileGpu; // vendorName can be "nvidia" or "amd"
};
import si from 'systeminformation';

export type GpuInfoObject = si.Systeminformation.GraphicsControllerData & {
    netterDeviceName: string; // should be like "ZOTAC_RTX_3070" | "MSI_RTX_2080_SUPER"
    gpuSysfsIndex: string;
    currentPciLinkSpeed: string;
    currentPciLinkWidth: string;
    maxPciLinkSpeed: string;
    maxPciLinkWidth: string;
};
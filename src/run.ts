import { setupNvidiaPowerSettings } from './libs/nvidiaGpu';
import { openSettings } from './utils/settings';
import { setupAmdPowerSettings } from './libs/amdGpu';

async function main() {
    const settings = openSettings();
    if (settings.nvidia && Object.keys(settings.nvidia).length > 0 && process.env.NVIDIA !== "false") {
	await setupNvidiaPowerSettings(settings, Object.keys(settings.nvidia));
    }
    if (settings.amd && Object.keys(settings.amd).length > 0 && process.env.AMD !== "false") {
	await setupAmdPowerSettings(settings, Object.keys(settings.amd));
    }
}

main();

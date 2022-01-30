import commandLineArgs from 'command-line-args';
import _ from 'lodash';
import { GpuTunerStrategy } from './controllers/tuners/GpuTunerStrategy';
import { openSettings } from './utils/settings';

const optionDefinitions = [
    { name: 'profile', alias: 'p', type: String },
    { name: 'brand', alias: 'b', type: String, multiple: true },
    { name: 'model', alias: 'm', type: String, multiple: true }
];

const options = commandLineArgs(optionDefinitions);

async function main() {
    const settings = openSettings();
    if(!options["profile"]) {
        throw new Error("Profile not passed. Use --profile parameter");
    }
    for (const brand of Object.keys(settings)) {
        if (options["brand"] && !options["brand"].includes(brand)) {
            continue;
        }
        if (Object.keys(settings[brand]).length > 0) {
            const instance = new GpuTunerStrategy().setStrategy(brand, settings[brand]);
            instance.setPowerProfile(options.profile);
            let modelsToApply = _.cloneDeep(Object.keys(settings[brand]));
            if(options["model"] instanceof Array && options["model"].length > 0) {
                modelsToApply = modelsToApply.filter(model => options["model"].includes(model));  
            }
            await instance.applyGpuPowerSettings(modelsToApply);
        }
    }
}

main().catch(console.error);
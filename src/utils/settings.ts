import { readFileSync } from "fs";
import { ISettingFile } from "../interfaces/ISettingsFile";

export function openSettings(): ISettingFile {
    const settingsFile: ISettingFile = JSON.parse(readFileSync("settings.json").toString());
    return settingsFile;
}
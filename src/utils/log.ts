const isDebug = process.env.DEBUG === "true";

export function debugLog(input: any) {
    if(isDebug === true) {
        console.debug(input);
    }
}
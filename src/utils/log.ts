export function debugLog(input: any) {
    if(process.env.DEBUG === "true") {
        console.debug(input);
    }
}
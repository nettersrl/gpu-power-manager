export const killProcessAndWaitForEnd = (pid: number, signal = 'SIGTERM', timeout: number = 60000) => new Promise<void>((resolve, reject) => {
  process.kill(pid, signal);
  let count = 0;
  setInterval(() => {
    try {
      process.kill(pid, 0);
    } catch (e) {
      // the process does not exists anymore
      resolve();
    }
    if ((count += 100) > timeout) {
      reject(new Error("Timeout process kill"))
    }
  }, 100)
});
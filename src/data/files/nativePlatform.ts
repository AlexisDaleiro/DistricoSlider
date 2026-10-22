import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Device } from '@capacitor/device';
import { setFilePlatform, type FilePlatform } from './platform';

/** Se instala antes de inicializar datos; en navegador no invoca ningún plugin. */
export function installNativeFilePlatform() {
  if (!Capacitor.isNativePlatform()) return;
  const adapter: FilePlatform = {
    writeFile: (options) =>
      Filesystem.writeFile({
        ...options,
        directory:
          options.directory === 'DOCUMENTS'
            ? Directory.Documents
            : Directory.Data,
      }),
    readdir: (options) =>
      Filesystem.readdir({ ...options, directory: Directory.Documents }),
    deleteFile: (options) =>
      Filesystem.deleteFile({ ...options, directory: Directory.Documents }),
    share: async (options) => {
      await Share.share(options);
    },
    battery: async () => {
      const info = await Device.getBatteryInfo();
      if (info.batteryLevel === undefined || info.isCharging === undefined)
        throw new Error('Batería no disponible.');
      return { level: info.batteryLevel, isCharging: info.isCharging };
    },
  };
  setFilePlatform(adapter);
}

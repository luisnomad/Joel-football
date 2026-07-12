import packageMetadata from '../package.json';

export const APP_NAME = 'Joel Football';
export const APP_VERSION = packageMetadata.version;
export const WEB_BUILD = 'web';

export const createWebAppInfo = () => Object.freeze({
  name: APP_NAME,
  version: APP_VERSION,
  build: WEB_BUILD,
  id: 'web',
});

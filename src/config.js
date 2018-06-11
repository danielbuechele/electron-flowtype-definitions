// Copyright 2004-present Facebook.

export default {
  releasesAPI: 'https://api.github.com/repos/electron/electron/releases',
  apiDefURL: (version: string) =>
    `https://github.com/electron/electron/releases/download/${version}/electron-api.json`,
};

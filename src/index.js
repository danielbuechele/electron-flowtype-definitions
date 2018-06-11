// Copyright 2004-present Facebook.

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import inquirer from 'inquirer';
import config from './config.js';
import ElectronFlowTypeGenerator from './ElectronFlowTypeGenerator.js';

(async () => {
  console.log(`Fetching electron versions from GitHub...`);
  const version = await fetch(config.releasesAPI)
    .then(res => res.json())
    .then(releases =>
      inquirer
        .prompt([
          {
            type: 'list',
            message:
              'For which version of electron would you like to create type definitions?',
            name: 'version',
            choices: releases.map(r => r.tag_name),
          },
        ])
        .then(answers => answers.version)
    )
    .catch(e => {
      console.error(`❌  Could not fetch electron releases from GitHub.`, e);
      process.exit(1);
    });

  console.log(
    `Fetching electron API defintion for electron ${version} from GitHub...`
  );
  fetch(config.apiDefURL(version))
    .then(res => {
      if (res.status === 200) {
      } else {
        throw new Error(
          `❌  Could not find API definition for electron ${version}.`
        );
      }
      return res;
    })
    .then(res => res.json())
    .then(async api => {
      const {processName} = await inquirer.prompt([
        {
          type: 'list',
          message: 'Generate definitions for main or renderer process?',
          name: 'processName',
          choices: ['main', 'renderer'],
        },
      ]);

      console.log(
        `Generate type definitions for electron ${version} ${processName} process...`
      );
      const eftg = new ElectronFlowTypeGenerator(version, api);
      const data = eftg.generateTypeDefinitions(processName);
      const outputDir = `./flow-typed/electron-${version}.js`;
      fs.writeFileSync(outputDir, data);
      return outputDir;
    })
    .then(outputDir =>
      console.log(
        `✅  Successfully generated flow type definitions for electron ${version} and wrote it to ${path.resolve(
          __dirname,
          outputDir
        )}`
      )
    )
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
})();

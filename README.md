# electron-flowtype-definitions

This module uses Electron's [JSON API documentation](https://electron.atom.io/blog/2016/09/27/api-docs-json-schema) to produce a flowtype definition file for the Electron API.

## Generate a library definition

To generate the type definitions for electron you need to clone this project and run it like this:

```
yarn install
yarn start
```

The CLI will ask you for the electron version and process[^1] you want the types generated for. Electron's API is different in the main and renderer process, so you need to decide which process you want to generate the definitions for. After that, a library definition file is created and put into `/flow-typed`.

[^1]: Electron runs two kind of processes. The main process, which is a headless node process that creates windows. Every window runs it's own renderer process, which runs in Chromium. You can learn more about this in the [Electron Documentation](https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes).

## Using the generated library definitions in your project

The generated file in `flow-typed/electron-vx.x.x.js` can then be moved to your project. You might already have a `flow-typed` directory in your project. If so, just place the generated file there. If not, create a folder called `flow-typed` next to your `.flowconfig` and place the file there. You can learn more about this in the [Flow documentation](https://flow.org/en/docs/config/libs/).

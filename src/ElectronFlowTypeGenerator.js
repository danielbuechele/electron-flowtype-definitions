// Copyright 2018-present Facebook.

const prettier = require('prettier');

const ARROW_FUNC_REGEX = /^\([^\)]*\) => \S+$/;
const STRING_LITERAL_REGEX = /^\'\S+\'$/;
const BUILT_INS = {
  Number: 'number',
  Boolean: 'boolean',
  String: 'string',
  Integer: 'number',
  Double: 'number',
  Float: 'number',
  Promise: 'Promise<any>',
  Array: 'Array<any>',
  true: 'true',
  false: 'false',
  Event: 'Event',
  any: 'any',
};

export default class ElectronFlowTypeGenerator {
  knownTypes: Set<string> = new Set();
  unknownTypes: Set<string> = new Set();
  rootLevel = [];
  version: string;
  apiDefinition: APIDefinition;

  constructor(version: string, apiDefinition: APIDefinition) {
    this.version = version;
    this.apiDefinition = apiDefinition;
  }

  generateTypeDefinitions = (processName: 'main' | 'renderer'): string => {
    let result = [
      // file header
      this.getHeader(this.version, processName),
      // main electron module
      this.declareModule(
        'electron',
        [
          // electron defined structures
          ...this.apiDefinition
            .filter(a => a.type === 'Structure')
            .map(this.structureToString),
          this.getModulesForProcess(processName),
          ...this.apiDefinition
            .filter(a => a.type === 'Element')
            .map(this.elementToString),
          ...this.apiDefinition
            .filter(a => a.type === 'Class')
            .map(this.classToString),
          // root level definitions
          ...this.rootLevel,

          // add unknown types
          ...[...this.unknownTypes]
            .filter(f => !this.knownTypes.has(f))
            .map(t => `declare type ${t} = any;`),
        ].join('\n')
      ),
    ];

    return prettier.format(result.join('\n'), {
      trailingComma: 'all',
      singleQuote: true,
      bracketSpacing: false,
      parser: 'flow',
    });
  };

  getModulesForProcess = (
    processName: 'main' | 'renderer',
    renderer: Function = this.moduleToString
  ): string => {
    const result = this.apiDefinition
      .map(
        a =>
          a.type === 'Module' &&
          !(a.process && !a.process[processName]) &&
          renderer(a, 'declare export var ')
      )
      .filter(Boolean);

    return result.join('\n');
  };

  elementToString = (e: electron$Element): string => {
    this.knownTypes.add(e.name);
    let result = `declare export class ${e.name} extends HTMLElement {`;
    if (e.methods) {
      result += e.methods.map(this.methodToString).join(',') + ',';
    }
    if (e.domEvents) {
      result += this.eventsToString(e.domEvents);
    }
    result += '}';
    return result;
  };

  classToString = (c: electron$Class, exports: boolean = true): string => {
    let result = '';
    if (c.constructorMethod) {
      result +=
        this.methodToString({
          name: 'constructor',
          ...c.constructorMethod,
          returns: [
            {
              type: c.name,
              required: true,
            },
          ],
        }) + ',';
    }
    if (c.staticMethods) {
      result +=
        c.staticMethods
          .map(this.methodToString)
          .map(m => `static ${m}`)
          .join(', ') + ',';
    }
    if (c.instanceMethods) {
      result += c.instanceMethods.map(this.methodToString).join(', ') + ',';
    }
    if (c.staticProperties) {
      result += c.staticProperties
        .map(p => ({...p, required: true}))
        .map(this.identifierToString)
        .map(i => `static ${i}`)
        .join('');
    }
    if (c.instanceProperties) {
      result += c.instanceProperties
        .map(p => ({...p, required: true}))
        .map(this.identifierToString)
        .join('');
    }
    if (c.instanceEvents) {
      result += this.eventsToString(c.instanceEvents);
    }
    this.knownTypes.add(c.name);
    return `declare ${exports ? 'export' : ''} class ${c.name} {
      ${result}
    }`;
  };

  structureToString = (s: electron$Structure): string => {
    this.knownTypes.add(s.name);
    return `declare type ${s.name} = {
      ${s.properties.map(this.identifierToString).join('')}
    }`;
  };

  moduleToString = (
    m: electron$Module,
    prefix: string,
    postfix?: string
  ): string => {
    let result = '';
    if (m.methods) {
      result += m.methods.map(this.methodToString).join(',\n') + ',';
    }
    if (m.events) {
      result += this.eventsToString(m.events);
      // TODO: emit, eventNames, addListener, removeAllListeners, removeListener
    }
    if (m.properties) {
      result += m.properties.map(this.identifierToString).join('\n');
    }
    return `${prefix || ''} ${m.name}: {
      ${result}
      ${
        m.name === 'remote'
          ? this.getModulesForProcess('main', m =>
            this.moduleToString(m, '', ',')
          )
          : ''
      }
    } ${postfix || ''}`;
  };

  eventsToString = (e: Array<electron$Event>): string => {
    return ['on', 'once']
      .map(
        method =>
          e
            .map((event, i) =>
              this.methodToString(
                {
                  name: method,
                  parameters: [
                    {
                      name: 'eventName',
                      type: `'${event.name}'`,
                      required: true,
                    },
                    {
                      name: 'callback',
                      type: `${this.signatureToString(event.returns)} => void`,
                      required: true,
                    },
                  ],
                },
                i > 0
              )
            )
            .join(' & ') + ','
      )
      .join('\n');
  };

  signatureToString = (p?: Array<Identifier>): string => {
    if (!p) {
      return '()';
    }
    return `(${p
      .map(this.identifierToString)
      .join(' ')
      .replace(/,\s*$/, '')})`;
  };

  methodToString = (m: Method, withoutName: boolean = false): string => {
    let result = `${
      withoutName === true ? '' : `${m.name}:`
    } (${this.signatureToString(m.parameters)} => `;

    if (m.returns) {
      result += []
        .concat(m.returns)
        // method returns are always guaranteed
        .map(r => ({...r, required: true}))
        .map(this.identifierToString)
        .join(' ');
    } else {
      result += 'void';
    }

    if (m.parameters && m.parameters.length > 1 && !m.parameters[0].required) {
      result +=
        ' | ' +
        this.methodToString(
          {
            ...m,
            parameters: m.parameters.slice(1),
          },
          true
        );
    }

    return result + ')';
  };

  identifierToString = (i: Identifier): string => {
    let result = '';
    if (i.type === 'Object') {
      result += '{\n';
      if (i.properties) {
        result += i.properties.map(this.identifierToString).join('\n');
      }
      result += '\n}';
    } else if (i.type === 'String' && i.possibleValues) {
      result += i.possibleValues.map(p => `'${p.value}'`).join(' | ');
    } else if (i.type === 'Class') {
      result += `Class<${i.name}>`;
      this.rootLevel.push(this.classToString(i, false));
    } else {
      result += []
        .concat(i.type)
        .filter(Boolean)
        .map(t => {
          if (typeof t === 'string') {
            // if not built in, string literal or arrow function, this type might
            // be unknown
            if (
              !global[t] &&
              !BUILT_INS[t] &&
              !STRING_LITERAL_REGEX.test(t) &&
              !ARROW_FUNC_REGEX.test(t)
            ) {
              this.unknownTypes.add(t);
            }
            return t;
          } else if (t.collection) {
            return `Array<${t.typeName}>`;
          } else {
            return t.typeName;
          }
        })
        .map(t => BUILT_INS[t] || t)
        .join(' | ');
    }

    if (result === '') {
      result = 'any';
    }

    if (i.collection) {
      result = `Array<${result}>`;
    }

    if (!i.required) {
      result = `?${result}`;
    }

    if (i.name) {
      // escape - and _ characters in keys
      const name = /-|_/.test(i.name) ? `'${i.name}'` : i.name;
      return `${name}${!i.required ? '?' : ''}: ${result},`;
    } else {
      return result;
    }
  };

  declareModule(name: string, content: string): string {
    return `declare module '${name}' {
      ${content}
    }`;
  }

  getHeader(version: string, process: string): string {
    return `/**
    * Copyright 2018-present Facebook.
    * This source code is licensed under the MIT license found in the
    * LICENSE file in the root directory of this source tree.
    * @format
    * @flow
    *
    * This is an autogenerated libdef for: electron-${version} ${process} process
   */
  `;
  }
}

#!/usr/bin/env node
'use strict';

const HELP = `
Synora Test Automation Framework

Usage:
  synora-test codegen [url]             Open browser recorder, generate YAML flow
  synora-test run <file|dir>            Run a YAML flow file or all flows in a folder
  synora-test suite <suite.yaml>        Run a multi-group test suite
  synora-test install [browser...]      Download browsers for the bundled Playwright (default: chromium)
  synora-test show-trace <trace.zip>    Open a recorded trace in Playwright Trace Viewer
  synora-test --help                    Show this help

Options for codegen:
  --output <file>                    Save recorded flow to file (default: stdout)
  --domain-mapping <file>            Maestro domain mapping JSON file

Options for run:
  --headed                           Run browser in headed mode (visible)
  --slow <ms>                        Slow down each step by <ms> milliseconds
  --browser <chromium|firefox|webkit> Browser to use (default: chromium)
  --timeout <ms>                     Action timeout in ms (default: 30000)
  --base-url <url>                   Override config.baseUrl in all flows
  --parallel <N> / -p <N>           Run up to N flows concurrently (default: 1)
  --trace [on|retain-on-failure|off] Record Playwright trace (default: off)
  --screenshot [on|only-on-failure|off]  Take screenshots (default: only-on-failure)
  --output-dir <dir>                 Directory for results (default: test-results)
  --no-report                        Skip HTML/JSON report generation

Options for suite:
  Same flags as run — they override values defined in suite.yaml config

Examples:
  synora-test codegen https://example.com
  synora-test codegen --output flows/login.yaml https://admin.synora/login
  synora-test run flows/login.yaml
  synora-test run flows/login.yaml --headed --slow 500
  synora-test run flows/ --parallel 3 --trace retain-on-failure
  synora-test suite suites/regression.yaml
  synora-test suite suites/regression.yaml --headed --base-url https://staging.synora
`;

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(HELP);
  process.exit(0);
}

switch (command) {
  case 'codegen':
    require('../src/cli/codegen').run(args.slice(1));
    break;
  case 'run':
    require('../src/cli/run').run(args.slice(1));
    break;
  case 'suite':
    require('../src/cli/suite').run(args.slice(1));
    break;
  case 'install':
  case 'show-trace': {
    // Pass-through to the bundled Playwright CLI
    const { PLAYWRIGHT_CLI } = require('../src/playwright');
    const rest = args.slice(1);
    if (command === 'install' && !rest.length)
      rest.push('chromium');
    const { status } = require('child_process').spawnSync(
      process.execPath, [PLAYWRIGHT_CLI, command, ...rest], { stdio: 'inherit' });
    process.exit(status ?? 1);
  }
  default:
    console.error(`Unknown command: ${command}\nRun synora-test --help for usage.`);
    process.exit(1);
}

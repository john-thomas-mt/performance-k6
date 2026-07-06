import yargs from 'yargs';
import fs from 'node:fs';
import path from 'node:path';
import { hideBin } from 'yargs/helpers';
import type { Site, ReleaseVersion } from '../../source/utils/types/config.type.ts';

interface Arguments {
  site: Site;
  env: ReleaseVersion;
}

const argv = yargs(hideBin(process.argv))
  .option('site', {
    alias: 's',
    type: 'string',
    choices: ['QE', 'AT', 'RC', 'PERF'],
    default: 'PERF',
    description: 'Target site (defaults to PERF, the only site perf tests run on; QE/AT/RC are debug-only)',
  })
  .option('env', {
    alias: 'e',
    type: 'string',
    default: 'main',
    description:
      'Release version path segment (defaults to main, the authoring target); valid values are the ReleaseVersion union in source/utils/types/config.type.ts',
  })
  .help()
  .parseSync() as Arguments;

const setup = {
  site: argv.site,
  env: argv.env,
};

const filePath = path.join('temp', 'setup.json');

fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, JSON.stringify(setup, null, 2));
console.log(`Success: ${filePath}`);

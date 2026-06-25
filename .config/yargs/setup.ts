import yargs from 'yargs';
import fs from 'node:fs';
import path from 'node:path';
import { hideBin } from 'yargs/helpers';

interface Arguments {
  site: string;
  env: string;
}

const argv = yargs(hideBin(process.argv))
  .option('site', {
    alias: 's',
    type: 'string',
    choices: ['QE', 'AT', 'RC'],
    default: 'AT',
    description: 'Target site',
  })
  .option('env', {
    alias: 'e',
    type: 'string',
    default: '26_2',
    description: 'Release version path segment, e.g. main, 26_2',
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

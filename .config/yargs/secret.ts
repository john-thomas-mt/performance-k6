import yargs from 'yargs';
import fs from 'node:fs';
import path from 'node:path';
import { hideBin } from 'yargs/helpers';

interface Arguments {
  key: string;
  datadog?: string;
}

const argv = yargs(hideBin(process.argv))
  .option('key', {
    alias: 'k',
    type: 'string',
    description:
      'Passphrase used to decrypt the user pool at runtime (same value used to mint the encrypted passwords in source/data/users.data.ts)',
    demandOption: true,
  })
  .option('datadog', {
    alias: 'd',
    type: 'string',
    description: 'Datadog API key used to stream live run metrics to the OTLP intake (omit to keep the value already in temp/secret.json)',
  })
  .help()
  .parseSync() as Arguments;

const filePath = path.join('temp', 'secret.json');

const existing = fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<Arguments>) : {};

const secret = {
  ...existing,
  key: argv.key ?? '',
  ...(argv.datadog ? { datadog: argv.datadog } : {}),
};

fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, JSON.stringify(secret, null, 2));
console.log(`Success: ${filePath}`);

import yargs from 'yargs';
import fs from 'node:fs';
import path from 'node:path';
import { hideBin } from 'yargs/helpers';

interface Arguments {
  key: string;
}

const argv = yargs(hideBin(process.argv))
  .option('key', {
    alias: 'k',
    type: 'string',
    description: 'Passphrase used to decrypt the user pool at runtime (same value used to mint the encrypted passwords in source/data/users.data.ts)',
    demandOption: true,
  })
  .help()
  .parseSync() as Arguments;

const secret = {
  key: argv.key ?? '',
};

const filePath = path.join('temp', 'secret.json');

fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, JSON.stringify(secret, null, 2));
console.log(`Success: ${filePath}`);

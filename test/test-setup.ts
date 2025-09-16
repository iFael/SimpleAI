import * as path from 'path';
const Mocha = require('mocha');
import { use } from 'chai';
const sinonChai = require('sinon-chai');
import * as glob from 'glob';

use(sinonChai);

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '..');
    const files = glob.sync('**/**.test.js', { cwd: testsRoot });

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    try {
        // Run the mocha test
        await new Promise<void>((resolve, reject) => {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error(err);
        throw err;
    }
}
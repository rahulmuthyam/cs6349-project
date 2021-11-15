#!/usr/bin/env node

const { program } = require('commander');
const server = require("./lib/server");
const client = require("./lib/client");
const { promises: fs } = require("fs");
const path = require("path");
const LogHorizon = require('log-horizon');
const logger = new LogHorizon({
    statusType: "badge"
});

program.version('0.0.1');

program
    .command('server')
    .option('--port <port>', 'port to bind to', 8080)
    .description('start a server on <port>')
    .action(async (options) => {
        server.listen(options.port);
    });

program
    .command('upload <file>')
    .option('--host <host>', 'server host to connect to', '127.0.0.1')
    .option('--port <port>', 'server port to connect to', 8080)
    .description('upload a file to a server')
    .action(async (file, {
        host, port
    }) => {
        try {
            const stat = await fs.stat(file);
            if (!stat) {
                throw Error(`file with path ${file} not found`);
            }

            await client.connect(host, port, 0, {
                name: path.basename(file),
                path: file,
                size: stat.size,
            });
        } catch (err) {
            logger.error(err);
        }
    });

program
    .command('download <file>')
    .option('--host <host>', 'server host to connect to', '127.0.0.1')
    .option('--port <port>', 'server port to connect to', 8080)
    .description('download a file from a server')
    .action(async (file, {
        host, port
    }) => {
        try {
            await client.connect(host, port, 1, {
                name: path.basename(file),
                path: file,
                size: 0
            });
        } catch (err) {
            logger.error(err);
        }
    });

program.parse();
const spawn = require('await-spawn');

const { ipcMain } = require("electron");
const ElectronPreferences = require("electron-preferences");
const { settings } = require("./settings");


module.exports = {
    async list_contracts() {
        const binary = settings.value("sapio.binary");
        const results = new Map();
        const contracts = (await spawn(binary, ["contract", "list"])).toString();
        let lines = contracts.trim().split(/\r?\n/).map((line) =>
        line.split(' -- ')
        );
        let apis = await Promise.all(lines.map(([name, key]) => {
            return spawn(binary, ["contract", "api", "--key", key]);
        }));
        let logos = await Promise.all(lines.map(([name, key]) => {
            console.log(key);
            return spawn(binary, ["contract", "logo", "--key", key]);
        }));

        for (var i = 0; i < lines.length; ++i) {
            const [name, key] = lines[i];
            const api = JSON.parse(apis[i].toString());
            const logo = logos[i].toString().trim();
            results.set(key, {
                name,
                key,
                api,
                logo
            });
        }
        return results;
        },
        async load_contract_file_name(file) {
            const binary = settings.value("sapio.binary");
            const child = await spawn(binary, ["contract", "load", "--file", file]);
            console.log(`child stdout:\n${child.toString()}`);

        },
        async create_contract(which, amount, args) {
            const binary = settings.value("sapio.binary");
            const child = await spawn(binary, ["contract", "create", amount, "--key", which,  args]);
            console.log(`child stdout:\n${child.toString()}`);

        }

    }
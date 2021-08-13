const spawn = require('await-spawn');

const { ipcMain } = require("electron");
const ElectronPreferences = require("electron-preferences");
const { settings } = require("./settings");


const memo_apis = new Map();
const memo_logos = new Map();

module.exports = {
    async list_contracts() {
        const binary = settings.value("sapio.binary");
        const results = new Map();
        const contracts = (await spawn(binary, ["contract", "list"])).toString();
        let lines = contracts.trim().split(/\r?\n/).map((line) =>
            line.split(' -- ')
        );

        let apis = await Promise.all(lines.map(([name, key]) => {
            if (memo_apis.has(key)) {
                return memo_apis.get(key);
            } else {
                return spawn(binary, ["contract", "api", "--key", key])
                    .then((v) => JSON.parse(v.toString()))
                    .then((api) => {
                        memo_apis.set(key, api);
                        return api;
                    })
            }
        }));
        let logos = await Promise.all(lines.map(([name, key]) => {
            if (memo_logos.has(key)) {
                return memo_logos.get(key);
            } else {
                return spawn(binary, ["contract", "logo", "--key", key])
                    .then((logo) => logo.toString().trim())
                    .then((logo) => {
                        memo_logos.set(key, logo);
                        return logo;
                    });
            }
        }));

        for (var i = 0; i < lines.length; ++i) {
            const [name, key] = lines[i];
            const api = apis[i];
            const logo = logos[i];
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
    async create_contract(which, args) {
        const binary = settings.value("sapio.binary");
        try {
            const create = await spawn(binary, ["contract", "create", "--key", which, args]);
            const created =  create.toString();
            const bind = await spawn(binary, ["contract", "bind", created]);
            const bound = bind.toString();
            const for_tux = await spawn(binary, ["contract", "for_tux", bound]);
            return for_tux.toString();
        } catch (e) {
            console.log(which, args);
        }


    }

}
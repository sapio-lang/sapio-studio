import { preferences } from "./settings";
import Client from 'bitcoin-core-ts';
import { readFile } from "fs/promises";
import { setTimeout } from "timers/promises";



let current_node: Client | null = null;
let initializing = true;
async function load_node_from_prefs(): Promise<Client> {

    await preferences.initialize();
    let network = preferences.data.bitcoin.network.toLowerCase();
    if (network === 'bitcoin') network = 'mainnet';
    const port = preferences.data.bitcoin.port;
    const host = preferences.data.bitcoin.host;
    let split: string[];
    if ('CookieFile' in preferences.data.bitcoin.auth) {
        const cookie = preferences.data.bitcoin.auth.CookieFile;
        let upw = await readFile(cookie, { encoding: 'utf-8' });
        split = upw.split(':');
    } else if ('UserPass' in preferences.data.bitcoin.auth) {
        split = preferences.data.bitcoin.auth.UserPass;
    } else {
        console.log('BROKEN');
        let client = new Client({
            network,
            port,
            host,
        });
        return client;
    }
    if (split.length === 2) {
        let username = split[0] ?? '';
        let password = split[1] ?? '';
        let client = new Client({
            network,
            username,
            password,
            port,
            host,
        });
        return client;
    } else {
        throw Error('Malformed Cookie File');
    }
}

export function deinit_bitcoin_node() {
    current_node = null;
}
export async function get_bitcoin_node(): Promise<Client> {
    // happy path
    if (current_node) return current_node;
    // only allow one initializer at a time...
    if (!initializing) {
        initializing = true;
        current_node = await load_node_from_prefs();
        initializing = false;
    } else while (initializing) await setTimeout(10);

    return get_bitcoin_node();
}
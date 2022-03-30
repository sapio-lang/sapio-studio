import Database from 'better-sqlite3';
import * as Bitcoin from 'bitcoinjs-lib';
import * as ed from '@noble/ed25519';
import { ipcMain } from 'electron';
import { EnvelopeIn, EnvelopeOut } from '../src/common/chat_interface';
import fetch from 'node-fetch';
import { stringify } from 'another-json';

let g_chat_server: ChatServer | null = null;
export function setup_chat() {
    ipcMain.handle('chat::init', async (event) => {
        const privateKey = ed.utils.randomPrivateKey();
        const publicKey = await ed.getPublicKey(privateKey);
        g_chat_server = new ChatServer(privateKey, publicKey);
    });
    ipcMain.handle('chat::send', async (event, message: EnvelopeIn) => {
        if (!g_chat_server) return;
        g_chat_server.send_message(message);
    });
    ipcMain.handle('chat::add_user', (event, name: string, key: string) => {
        if (!g_chat_server) return;
        g_chat_server.add_user(name, key);
    });
    ipcMain.handle('chat::list_users', (event) => {
        if (!g_chat_server) return;
        g_chat_server.list_users();
    });
    ipcMain.handle('chat::list_channels', (event) => {
        if (!g_chat_server) return;
        g_chat_server.list_channels();
    });
    ipcMain.handle('chat::list_messages_channel', (event, channel) => {
        if (!g_chat_server) return;
        g_chat_server.list_messages_channel(channel);
    });
}

class ChatServer {
    db: Database.Database;
    insert: Database.Statement;
    list_all_users: Database.Statement;
    list_all_channels: Database.Statement;
    list_msg_chan: Database.Statement;
    my_pk: Uint8Array;
    my_sk: Uint8Array;
    constructor(privateKey: Uint8Array, publicKey: Uint8Array) {
        this.db = new Database(
            '/Users/jr/Library/Application Support/org.judica.tor-chat/chat.sqlite3',
            { readonly: false }
        );
        this.insert = this.db.prepare(
            'INSERT INTO user (nickname, key) VALUES (@name, @key)'
        );
        this.list_all_users = this.db.prepare(
            'SELECT nickname, key from user;'
        );
        this.list_all_channels = this.db.prepare(
            'SELECT DISTINCT channel_id from messages;'
        );
        this.list_msg_chan = this.db.prepare(
            'SELECT * from messages where channel_id=@chan;'
        );
        this.my_pk = publicKey;
        this.my_sk = privateKey;
    }
    add_user(name: string, key: string) {
        this.insert.run({ name, key });
    }

    list_users(): [string, string][] {
        let res: any[] = this.list_all_users.all();
        return res;
    }

    list_channels(): string[] {
        return this.list_all_channels.all();
    }
    list_messages_channel(chan: string) {
        return this.list_msg_chan.all({ chan });
    }

    async send_message(m: EnvelopeIn): Promise<void> {
        const channel = Bitcoin.crypto
            .sha256(Buffer.from(m.channel))
            .toString('hex');
        const partial: Partial<EnvelopeOut> = {};
        partial.channel = channel;
        partial.key = Array.from(this.my_pk);
        partial.msg = m.msg;
        const encoded = Buffer.from(stringify(partial), 'utf-8');
        console.log(encoded.toString('utf-8'));
        console.log(partial);
        // keys, messages & other inputs can be Uint8Arrays or hex strings
        // Uint8Array.from([0xde, 0xad, 0xbe, 0xef]) === 'deadbeef'
        const message = Uint8Array.from(encoded);

        const signature = Buffer.from(
            await ed.sign(message, this.my_sk)
        ).toString('base64');
        //        const isValid = await ed.verify(signature, message, publicKey);
        partial.signatures = {
            [Bitcoin.crypto.sha256(Buffer.from(this.my_pk)).toString('hex')]: {
                'ed25519:1': signature,
            },
        };
        await fetch('http://127.0.0.1:46789/msg', {
            method: 'POST',
            body: JSON.stringify(partial) + '\n',
        });
    }
}

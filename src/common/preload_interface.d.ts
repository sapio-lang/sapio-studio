import { JSONSchema7 } from 'json-schema';
import { schemas } from './settings_gen';
export type Result<T> = { ok: T } | { err: string };

export const callbacks = {
    simulate: 0,
    load_hex: 0,
    save_hex: 0,
    create_contracts: 0,
    load_contract: 0,
    'bitcoin-node-bar': 0,
};
export type ContractArgs = {
    arguments: Record<string | number, unknown>;
    context: {
        amount: number;
        network: 'Regtest' | 'Signet' | 'Testnet' | 'Bitcoin';
        effects?: {
            effects?: Record<
                string,
                Record<string, Record<string | number, unknown>>
            >;
        };
    };
};

export type Callbacks = keyof typeof callbacks;
export type API = Record<
    string,
    { name: string; key: string; api: JSONSchema7; logo: string }
>;
export type CreatedContract = {
    name: string;
    args: ContractArgs;
    data: Data;
};

export type APIPath = string;
export type Continuation = {
    schema: JSONSchema7;
    path: APIPath;
};
export type DataItem = {
    txs: Array<{ linked_psbt: TransactionData }>;
    continue_apis: Record<APIPath, Continuation>;
};
export type Data = {
    program: Record<APIPath, DataItem>;
};

export type TransactionData = {
    psbt: string;
    hex: string;
    metadata: {
        color?: string;
        label?: string;
    };
    output_metadata?: Array<UTXOFormatData | null>;
};

export type UTXOFormatData = {
    color: string;
    label: string;
};

export type ContinuationTable = Record<string, Record<APIPath, Continuation>>;
export type preloads = {
    bitcoin_command: (
        command: {
            method: string;
            parameters: any[];
        }[]
    ) => Promise<any>;
    //    register_callback: (msg: Callbacks, action: (args: any) => void) => () => void;
    save_psbt: (psbt: string) => Promise<null>;

    save_contract: (contract: string) => Promise<null>;
    fetch_psbt: () => Promise<string>;
    write_clipboard: (s: string) => void;
    save_settings: (
        which: keyof typeof schemas,
        data: string
    ) => Promise<boolean>;
    load_settings_sync: (which: keyof typeof schemas) => any;
    select_filename: () => Promise<string | null>;
    sapio: {
        create_contract: (
            which: string,
            args: string
        ) => Promise<Result<string | null>>;
        show_config: () => Promise<Result<string>>;
        load_wasm_plugin: () => Promise<Result<null>>;
        open_contract_from_file: () => Promise<Result<string>>;
        load_contract_list: () => Promise<Result<API>>;
        compiled_contracts: {
            list: () => Promise<string[]>;
            trash: (file_name: string) => Promise<void>;
            open: (file_name: string) => Promise<Result<CreatedContract>>;
        };
        psbt: {
            finalize: (psbt: string) => Promise<Result<string>>;
        };
    };
    emulator: {
        kill: () => Promise<void>;
        start: () => Promise<void>;
        read_log: () => Promise<string>;
    };
};
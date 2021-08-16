import App from '../App';

type Command = 'menu' | 'created' | 'finish_open';
export class CompilerServer {
    location: string;
    socket: WebSocket | undefined;
    app: App;
    expected_next: Array<[Command, any]>;
    menu_content: Array<[string, Array<[string, any]>]>;
    constructor(location: string | null, app: App) {
        // TODO: Fix!
        this.location = location || 'ws://localhost:8888';
        this.app = app;
        this.expected_next = [['menu', null]];
        this.menu_content = [];
        window.electron.register(
            'create_contract_from_cache',
            async ([which, args]: [string, string]) => {
                await this.create(which, args);
            }
        );
    }

    // Contract Creation
    async create(type_arg: string, contract: any) {
        const compiled_contract = await window.electron.create_contract(
            type_arg,
            contract
        );
        this.app.load_new_model(JSON.parse(compiled_contract));
    }
}

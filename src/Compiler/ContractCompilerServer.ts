import App from "../App";

type Command = "menu" | "created" | "finish_open";
export class CompilerServer {
    location:string;
    socket: WebSocket | undefined;
    app: App;
    expected_next: Array<[Command, any]>;
    menu_content: Array<[string, Array<[string, any]>]>;
    constructor(location:string|null, app:App) {
        // TODO: Fix!
        this.location = location || "ws://localhost:8888";
        this.app = app;
        this.expected_next = [["menu", null]];
        this.menu_content = [];
        this.connect(this);
    }
    connect(that:CompilerServer) {
        const ALLOWED_OPEN = new Set(["menu", "created", "finish_open"]);
        const DISPATCHER = new Map([
            ["menu", that.menu.bind(that)],
            ["created", that.created.bind(that)],
            ["finish_open", () => ALLOWED_OPEN.clear()]
        ]);
        let socket = new WebSocket(that.location);
        this.socket = socket;
        socket.onopen = function () {
            console.log('Connected!');
        };
        socket.onmessage = function (event) {
            let { action, content } = JSON.parse(event.data)
            let callback = () => null;
            if (that.expected_next.length) {
                let expected = that.expected_next.shift();
                if (!expected) return;
                if (expected[0] == action) {
                    callback = expected[1];
                } else {
                    throw "Expected to get a " + expected[0] + ", but got a " + action;
                }
            } else if (ALLOWED_OPEN.has(action)) {

            } else {
                throw "Didn't expect to get a " + action;
            }
            
            let handler = DISPATCHER.get(action);
            if (handler) {
                handler(content, callback);
            }
        };
        socket.onclose = function () {

            that.expected_next = [["menu", null]];
            that.menu_content = [];
            setTimeout(() => that.connect(that), 500)
        };
        socket.onerror = function () {
            console.log('Error!');
        };
    }
    menu(content : Array<[string, Array<[string, any]>]>) {
        this.menu_content = content;
        this.app.setState({dynamic_forms: this.menu_content});
        console.log(this.menu_content);
    }
    // Contract Creation
    create(type_arg:string, contract:any, callback: any) {
        if (!this.socket) return;
        this.expected_next.push(["created", callback]);
        let json = 
            JSON.stringify({'action':"create", 'content': {'type': type_arg, 'args':contract}});
        console.log(json);
        this.socket.send(json);
    }
    created(contract:any, callback:any) {
        console.log(contract, callback);
        // TODO: Use the callback actually...
        this.app.load_new_model(contract[2]);
    }
}



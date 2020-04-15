import FormControl from 'react-bootstrap/FormControl';
export class CompilerServer {
    constructor(location, app) {
        // TODO: Fix!
        this.location = location || "ws://localhost:8888";
        this.socket = null;
        this.app = app;
        this.connect();
    }
    connect() {
        const DISPATCHER = new Map([
            ["menu", this.menu.bind(this)],
        ]);
        this.socket = new WebSocket(this.location);
        this.socket.onopen = function () {
            console.log('Connected!');
        };
        this.socket.onmessage = function (event) {
            let { type, content } = JSON.parse(event.data)
            if (DISPATCHER.has(type)) {
                DISPATCHER.get(type)(content);
            }
        };
        this.socket.onclose = function () {
            console.log('Lost connection!');
        };
        this.socket.onerror = function () {
            console.log('Error!');
        };
    }
    menu(content) {
        this.menu = content;
        this.app.setState({dynamic_forms: this.menu});
        console.log(this.menu);
    }
}



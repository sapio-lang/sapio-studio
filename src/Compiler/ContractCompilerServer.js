import FormControl from 'react-bootstrap/FormControl';
export class CompilerServer {
    constructor(location, app) {
        // TODO: Fix!
        this.location = location || "ws://localhost:8888";
        this.socket = null;
        this.app = app;
        this.expected_next = [["menu", null]];
        this.connect();
    }
    connect() {
        const DISPATCHER = new Map([
            ["menu", this.menu.bind(this)],
            ["created", this.created.bind(this)],
        ]);
        let socket = new WebSocket(this.location);
        socket.onopen = function () {
            console.log('Connected!');
        };
        const that = this;
        socket.onmessage = function (event) {
            let { type, content } = JSON.parse(event.data)
            let expected = that.expected_next.shift();
            if (expected[0] != type) {
                throw "Expected to get a "+expected[0] + ", but got a "+type;
            }
            if (DISPATCHER.has(type)) {
                let f = () => null;
                DISPATCHER.get(type)(content, expected[1] || f);
            }
        };
        socket.onclose = function () {
        };
        socket.onerror = function () {
            console.log('Error!');
        };
        this.socket = socket;
    }
    menu(content) {
        this.menu = content;
        this.app.setState({dynamic_forms: this.menu});
        console.log(this.menu);
    }
    // Contract Creation
    create(type_arg, contract, callback) {
        this.expected_next.push(["created", callback]);
        let json = 
            JSON.stringify({'type':"create", 'content': {'type': type_arg, 'args':contract}});
        console.log(json);
        this.socket.send(json);
    }
    created(contract, callback) {
        console.log(contract);
        callback(contract[2]);
    }
}



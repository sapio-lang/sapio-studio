import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
export class CompilerServer {
    constructor(location) {
        // TODO: Fix!
        this.location = location || "ws://localhost:8888";
        this.socket = null;
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
    }
}

class Menu extends React.Component {
    render() {
        let components = [];
        for (let contract_name in this.state) {
            console.log("MENU", contract_name, this.state[contract_name]);
            components.append((<MenuForm name={contract_name} args={this.state[contract_name]} />));
        }
        return (<> {components} </>);
    }
}


class MenuForm extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    handleSubmit(event) {
                    event.preventDefault();
        const form = event.currentTarget;
        if (form.checkValidity() === false) {
                    event.stopPropagation();
        }
        /*
        const amounts = new Map(this.form.amount.value.trim().split(/\r?\n/)
            .map(l => l.trim().split(" ")));
        let radix = this.form.radix.valueAsNumber;
        console.log("radix " + radix);
        if (Number.isNaN(radix)) {
                    radix = 4;
        }
        console.log("radix " + radix);
        let gas = this.form.gas.valueAsNumber;
        if (Number.isNaN(gas)) {
                    gas = 0;
        }
        const pairing_mode = this.form.pairing_mode.value;
        this.props.vaultman.create_batchpay({ amounts: Object.fromEntries(amounts.entries()), radix, gas, pairing_mode });
        */
        this.props.hide();
    }

    render() {
        let form_groups = [];
        for (let arg in this.props.args) {
            let type = this.props.args[arg];
            form_groups.append((
                <Form.Group>
                    <Form.Label> {arg} </Form.Label>
                    <Form.Label> {type} </Form.Label>
                    <Form.Control as="textarea" placeholder="bcrt1q0548jkmkzksch8hc367jm77up40yydqh87e3qa 1.4" ref={(amt) => this.form.amount = amt} rows="6" />
                </Form.Group>
            ));
        }
        return (<Form onSubmit={this.handleSubmit.bind(this)}>
                    {form_groups}
                    <Button type="submit">Submit</Button>
                </Form>);
    }
}


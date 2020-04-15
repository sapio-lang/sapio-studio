import React from 'react';
import { ContractModel } from './ContractManager';
import { call } from './util';
import { hash_to_hex } from './Hex';
import Button from 'react-bootstrap/Button';
import Nav from 'react-bootstrap/Nav';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import Tab from 'react-bootstrap/Tab';
export class VaultManager {
    constructor(app) {
        this.app = app;
        this.confirmed_txs = new Set();
        this.periodic_check();
    }
    async periodic_check() {
        const is_tx_confirmed = await this.check_txs();
        if (is_tx_confirmed.length > 0) {
            is_tx_confirmed.forEach((txid) => this.confirmed_txs.add(txid));
            this.update_broadcastable();
            this.app.vault.process_finality(is_tx_confirmed, this.app.model);
            this.app.forceUpdate();
        }
        setTimeout(this.periodic_check.bind(this), 1000);
    }
    async create_vault(args) {
        call("/backend/create_vault", args)
            .then(data => new ContractModel(this.app.update_viewer.bind(this.app), data))
            .then(async (vault) => {
                this.app.vault.unload(this.app.model);
                vault.load(this.app.model);
                this.app.vault = vault;
                this.app.setState({ vault });
                this.update_broadcastable();
                this.app.forceUpdate();
                setTimeout(() => { this.app.redistribute(); this.app.engine.zoomToFit(); }, 100);
            });
    }
    async create_batchpay(args) {
        call("/backend/create_batchpay", args)
            .then(data => {
                return new ContractModel(this.app.update_viewer.bind(this.app), data);
            })
            .then(async (vault) => {
                this.app.vault.unload(this.app.model);
                vault.load(this.app.model);
                this.app.vault = vault;
                this.app.setState({ vault });
                this.update_broadcastable();
                this.app.forceUpdate();
                setTimeout(() => { this.app.redistribute(); this.app.engine.zoomToFit(); }, 100);
            });
    }
    update_broadcastable() {
        this.app.vault.txn_models
            .forEach((tm) => {
                const already_confirmed = this.confirmed_txs.has(tm.tx.getTXID());
                const inputs_not_locals = tm.tx.ins.every((inp) => !this.app.vault.txid_map.has(hash_to_hex(inp.hash)));
                const all_inputs_confirmed = tm.tx.ins.every((inp) => this.confirmed_txs.has(hash_to_hex(inp.hash)));
                if (already_confirmed) {
                    tm.set_broadcastable(false);
                }
                else if (inputs_not_locals) {
                    tm.set_broadcastable(true);
                }
                else if (all_inputs_confirmed) {
                    tm.set_broadcastable(true);
                }
                else {
                    tm.set_broadcastable(false);
                }
            });
    }
    async check_txs() {
        const txids = this.app.vault.txn_models
            .filter((tm) => tm.is_broadcastable())
            .map((tm) => tm.tx.getTXID());
        if (txids.length > 0)
            return await call("/backend/get_transactions", txids);
        return [];
    }
}
class CreateVaultForm extends React.Component {
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
        this.props.vaultman.create_vault({ amount: this.form.amount.valueAsNumber, steps: this.form.steps.valueAsNumber, step_period: this.form.step_period.valueAsNumber, maturity: this.form.maturity.valueAsNumber });
        this.props.hide();
    }
    ;
    render() {
        return (<Form onSubmit={this.handleSubmit.bind(this)}>
            <FormControl type="number" placeholder="Amount per Step" className=" mr-sm-1" ref={(amt) => this.form.amount = amt} min="0" max="21000000" step="0.00000001" />
            <FormControl type="number" placeholder="Steps" className=" mr-sm-1" ref={(amt) => this.form.steps = amt} min="1" max="100000" step="1" />
            <FormControl type="number" placeholder="Step Timeout" className=" mr-sm-1" ref={(amt) => this.form.step_period = amt} min="0" max="10000" step="1" />
            <FormControl type="number" placeholder="Withdraw Timeout" className=" mr-sm-1" ref={(amt) => this.form.maturity = amt} min="0" max="10000" step="1" />
            <Button type="submit">Submit</Button>
        </Form>);
    }
}
class CreateBatchPayForm extends React.Component {
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
        this.props.hide();
    }
    ;
    render() {
        return (<Form onSubmit={this.handleSubmit.bind(this)}>
            <Form.Group>
                <Form.Label> Payments to Make </Form.Label>
                <Form.Control as="textarea" placeholder="bcrt1q0548jkmkzksch8hc367jm77up40yydqh87e3qa 1.4" ref={(amt) => this.form.amount = amt} rows="6" />
            </Form.Group>
            <Form.Group>
                <Form.Label> Radix </Form.Label>
                <Form.Text className="text-muted">
                    Radix -- n for n, 1 for linear, 0 for packed, -n for at most n descendants.
                    </Form.Text>
                <FormControl type="number" placeholder="4" className=" mr-sm-1" ref={r => this.form.radix = r} max="21000000" step="1" />
            </Form.Group>
            <Form.Group>
                <Form.Label> Gas Ports to Include </Form.Label>
                <Form.Text className="text-muted">
                    value must be unspecified or above or equal to 472.
                    </Form.Text>
                <FormControl type="number" placeholder="None" className=" mr-sm-1" ref={r => this.form.gas = r} min="472" max="14610" step="1" />
            </Form.Group>
            <Form.Group>
                <Form.Label> Output Sorting Method </Form.Label>
                <FormControl as="select" className=" mr-sm-2" ref={r => this.form.pairing_mode = r}>
                    <option value="AS_IS">As Is</option>
                    <option value="VALUE">Group By Value</option>
                    <option value="BALANCE_VALUE">Balance By Value</option>
                    <option value="PROBABILITY">Group By Probability</option>
                    <option value="BALANCE_PROBABILITY">Balance By Probability</option>
                    <option value="LEXICOGRAPHICAL">Lexicographical</option>
                </FormControl>
            </Form.Group>
            <Button type="submit">Submit</Button>
        </Form>);
    }
}
export class CreateVaultModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        return (<Modal show={this.props.show} onHide={this.props.hide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title> Create a New Vault </Modal.Title>
            </Modal.Header>

            <Tab.Container defaultActiveKey="vault">
                <Nav variant="tabs" justify className="navbar">
                    <Nav.Item> <Nav.Link eventKey="vault"> Vault </Nav.Link> </Nav.Item>
                    <Nav.Item> <Nav.Link eventKey="batchpay"> BatchPay </Nav.Link> </Nav.Item>
                </Nav>
                <Tab.Content>
                    <Tab.Pane eventKey="vault" title="Vault">
                        <CreateVaultForm hide={this.props.hide} vaultman={this.props.vaultman} />
                    </Tab.Pane>
                    <Tab.Pane eventKey="batchpay" title="BatchPay">
                        <CreateBatchPayForm hide={this.props.hide} vaultman={this.props.vaultman} />
                    </Tab.Pane>
                </Tab.Content>
            </Tab.Container>
            <Modal.Footer>
                <Button variant="secondary" onClick={this.props.hide}> Close </Button>
            </Modal.Footer>
        </Modal>);
    }
}
export class ViewVaultModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        return (<Modal show={this.props.show} onHide={this.props.hide}>
            <Modal.Header closeButton>
                <Modal.Title> View Existing Vault </Modal.Title>
            </Modal.Header>
            <Form>
                <FormControl as="select" placeholder="Existing Vault" className=" mr-sm-2" />
                <Button type="submit">View</Button>
            </Form>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => this.setState({ modal_view: false })}> Close </Button>
            </Modal.Footer>
        </Modal>);
    }
}


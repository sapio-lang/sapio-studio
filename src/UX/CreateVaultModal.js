import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import { Menu } from '../Compiler/Menu';
import { txid_buf_to_string } from '../util';
export class CreateContractModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        if (!this.props.dynamic_forms) return null;
        return (
            <Modal show={this.props.show} onHide={this.props.hide} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title> Applications </Modal.Title>
                </Modal.Header>

                <Menu
                    hide={this.props.hide}
                    load_new_model={this.props.load_new_model}
                    args={this.props.dynamic_forms}
                    export
                    compiler={this.props.compiler}
                />
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => this.props.hide()}
                    >
                        {' '}
                        Close{' '}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
export class ViewContractModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        return (
            <Modal show={this.props.show} onHide={this.props.hide}>
                <Modal.Header closeButton>
                    <Modal.Title> View Existing Contract </Modal.Title>
                </Modal.Header>
                <Form>
                    <FormControl
                        as="select"
                        placeholder="Existing Contract"
                        className=" mr-sm-2"
                    />
                    <Button type="submit">View</Button>
                </Form>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => this.props.hide()}
                    >
                        {' '}
                        Close{' '}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export class SapioCompilerModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    handleSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        this.props.compiler.location = form.elements.ws.value;
        // triggers reconnect
        this.props.compiler.socket.close();
        this.props.hide();
    }
    render() {
        return (
            <Modal show={this.props.show} onHide={this.props.hide}>
                <Modal.Header closeButton>
                    <Modal.Title> Set Contract Generator URL </Modal.Title>
                </Modal.Header>
                <Form onSubmit={(e) => this.handleSubmit(e)}>
                    <FormControl
                        name="ws"
                        type="text"
                        placeholder="url"
                        defaultValue={this.props.compiler.location}
                    />
                    <Button type="submit">Set</Button>
                </Form>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => this.props.hide()}
                    >
                        {' '}
                        Close{' '}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export class LoadHexModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    handleSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        this.props.load_new_model(JSON.parse(form.elements.data.value));
        this.props.hide();
    }
    render() {
        const txt = `
        The data pasted should be of format:
    Array<{ hex: string, color?: string, label?: string, utxo_metadata?: Array<{color: string, label:string} | null>>.

    If you just have hex, e.g. [{'hex': 'ffaa...'}, ...].
`;
        return (
            <Modal show={this.props.show} onHide={this.props.hide}>
                <Modal.Header closeButton>
                    <Modal.Title> Paste Hex JSON </Modal.Title>
                </Modal.Header>
                <Form onSubmit={(e) => this.handleSubmit(e)}>
                    <Form.Label>{txt}</Form.Label>
                    <FormControl name="data" as="textarea" />
                    <Button type="submit">Load</Button>
                </Form>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => this.props.hide()}
                    >
                        {' '}
                        Close{' '}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export class SaveHexModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        let non_phantoms = this.props.contract.txn_models.filter((item) => {
            return (
                -1 !==
                item.tx.ins.findIndex((inp) =>
                    this.props.contract.txid_map.has_by_txid(
                        txid_buf_to_string(inp.hash)
                    )
                )
            );
        });
        const data = { program: non_phantoms.map((t) => t.get_json()) };
        return (
            <Modal show={this.props.show} onHide={this.props.hide}>
                <Modal.Header closeButton>
                    <Modal.Title>Copy Hex JSON </Modal.Title>
                </Modal.Header>
                <Form onSubmit={(e) => this.handleSubmit(e)}>
                    <FormControl
                        name="data"
                        as="textarea"
                        defaultValue={JSON.stringify(data)}
                    />
                </Form>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => this.props.hide()}
                    >
                        {' '}
                        Close{' '}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

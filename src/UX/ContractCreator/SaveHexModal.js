import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import { txid_buf_to_string } from '../../util';

export class SaveHexModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        let non_phantoms = this.props.contract.txn_models.filter((item) => {
            return (
                -1 !==
                item.tx.ins.findIndex((inp) => this.props.contract.txid_map.has_by_txid(
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
                        defaultValue={JSON.stringify(data)} />
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

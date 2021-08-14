import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';

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

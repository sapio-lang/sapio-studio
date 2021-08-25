import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import { useDispatch } from 'react-redux';
import { load_new_model } from '../../AppSlice';

export function LoadHexModal(props) {
    const form = {};
    const dispatch = useDispatch();
    function handleSubmit(event) {
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        dispatch(load_new_model(JSON.parse(form.elements.data.value)));
        this.props.hide();
    }
    const txt = `
        The data pasted should be of format:
    Array<{ hex: string, color?: string, label?: string, utxo_metadata?: Array<{color: string, label:string} | null>>.

    If you just have hex, e.g. [{'hex': 'ffaa...'}, ...].
`;
    return (
        <Modal show={props.show} onHide={props.hide}>
            <Modal.Header closeButton>
                <Modal.Title> Paste Hex JSON </Modal.Title>
            </Modal.Header>
            <Form onSubmit={(e) => handleSubmit(e)}>
                <Form.Label>{txt}</Form.Label>
                <FormControl name="data" as="textarea" />
                <Button type="submit">Load</Button>
            </Form>
            <Modal.Footer>
                <Button
                    variant="secondary"
                    onClick={() => props.hide()}
                >
                    {' '}
                    Close{' '}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
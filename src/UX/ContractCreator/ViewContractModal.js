import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';

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

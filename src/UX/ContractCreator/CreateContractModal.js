import React from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { Menu } from './Menu';

export class CreateContractModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        if (!this.props.dynamic_forms)
            return null;
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
                    compiler={this.props.compiler} />
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

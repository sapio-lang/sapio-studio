import React from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { PluginSelector } from './SapioPluginPicker/PluginSelector';

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

                <PluginSelector
                    hide={this.props.hide}
                    load_new_model={this.props.load_new_model}
                    applications={this.props.dynamic_forms}
                    export
                    compiler={this.props.compiler} />
            </Modal>
        );
    }
}

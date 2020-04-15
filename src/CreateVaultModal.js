import React from 'react';
import Button from 'react-bootstrap/Button';
import Nav from 'react-bootstrap/Nav';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import Tab from 'react-bootstrap/Tab';
import { CreateVaultForm, CreateBatchPayForm } from './CreateVaultForm';
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

import React from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import { CreateVaultModal, ViewVaultModal } from './VaultManager';
export class AppNavbar extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.state.modal_view = false;
        this.state.modal_create = false;
    }
    render() {
        return (<Navbar>
            <Navbar.Brand> VaultMan </Navbar.Brand>

            <Nav className="justify-content-end w-100">
                <Nav.Link eventKey="create" onSelect={() => this.setState({ modal_create: true })} aria-controls="create-vault-form" aria-expanded={this.state.modal_create}>
                    New
                </Nav.Link>

                <Nav.Link eventKey="view" onSelect={() => this.setState({ modal_view: true })} aria-controls="create-vault-form" aria-expanded={this.state.modal_view}>
                    View
                </Nav.Link>
            </Nav>
            <CreateVaultModal show={this.state.modal_create} hide={() => this.setState({ modal_create: false })} vaultman={this.props.vaultman} />
            <ViewVaultModal show={this.state.modal_view} hide={() => this.setState({ modal_view: false })} vaultman={this.props.vaultman} />


        </Navbar>);
    }
}

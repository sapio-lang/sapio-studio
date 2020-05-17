import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import Tab from 'react-bootstrap/Tab';
import { Menu } from '../Compiler/Menu';
export class CreateContractModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        if (!this.props.dynamic_forms) return null;
        return (<Modal show={this.props.show} onHide={this.props.hide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title> Create a New Contract </Modal.Title>
            </Modal.Header>


            <Menu hide={this.props.hide} load_new_model={this.props.load_new_model}
                args={this.props.dynamic_forms}
                export compiler={this.props.compiler} />
            <Modal.Footer>
                <Button variant="secondary" onClick={this.props.hide}> Close </Button>
            </Modal.Footer>
        </Modal>);
    }
}
export class ViewContractModal extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    render() {
        return (<Modal show={this.props.show} onHide={this.props.hide}>
            <Modal.Header closeButton>
                <Modal.Title> View Existing Contract </Modal.Title>
            </Modal.Header>
            <Form>
                <FormControl as="select" placeholder="Existing Contract" className=" mr-sm-2" />
                <Button type="submit">View</Button>
            </Form>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => this.setState({ modal_view: false })}> Close </Button>
            </Modal.Footer>
        </Modal>);
    }
}

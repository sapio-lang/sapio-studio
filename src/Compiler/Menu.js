import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
class Menu extends React.Component {
    render() {
        let components = [];
        for (let contract_name in this.state) {
            console.log("MENU", contract_name, this.state[contract_name]);
            components.push((<MenuForm name={contract_name} args={this.state[contract_name]} />));
        }
        return (<> {components} </>);
    }
}
export class MenuForm extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    handleSubmit(event) {
        const compiler = this.props.compiler;
        event.preventDefault();
        const form = event.currentTarget;
        if (form.checkValidity() === false) {
            event.stopPropagation();
        }
        let contract = {};
        for (let arg in this.props.args) {
            console.log(this.props.args[arg]);
            contract[arg] = JSON.parse(this.form[arg].value);
        }
        console.log(contract);
        compiler.create(this.props.type, contract, this.props.load_new_model);

        this.props.hide();
    }
    render() {
        let form_groups = [];
        for (let arg in this.props.args) {
            let type = this.props.args[arg];
            form_groups.push((<Form.Group>
                <Form.Label> {arg} </Form.Label>
                <Form.Control type="text"
                placeholder={JSON.stringify(type)}
                ref={(amt) => this.form[arg]= amt}
                 />
            </Form.Group>));
        }
        return (<Form onSubmit={this.handleSubmit.bind(this)}>
            {form_groups}
            <Button type="submit">Submit</Button>
        </Form>);
    }
}

import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
export class CreateVaultForm extends React.Component {
    constructor(props) {
        super(props);
        this.form = {};
    }
    handleSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (form.checkValidity() === false) {
            event.stopPropagation();
        }
        this.props.vaultman.create_vault({ amount: this.form.amount.valueAsNumber, steps: this.form.steps.valueAsNumber, step_period: this.form.step_period.valueAsNumber, maturity: this.form.maturity.valueAsNumber });
        this.props.hide();
    }
    ;
    render() {
        return (<Form onSubmit={this.handleSubmit.bind(this)}>
            <FormControl type="number" placeholder="Amount per Step" className=" mr-sm-1" ref={(amt) => this.form.amount = amt} min="0" max="21000000" step="0.00000001" />
            <FormControl type="number" placeholder="Steps" className=" mr-sm-1" ref={(amt) => this.form.steps = amt} min="1" max="100000" step="1" />
            <FormControl type="number" placeholder="Step Timeout" className=" mr-sm-1" ref={(amt) => this.form.step_period = amt} min="0" max="10000" step="1" />
            <FormControl type="number" placeholder="Withdraw Timeout" className=" mr-sm-1" ref={(amt) => this.form.maturity = amt} min="0" max="10000" step="1" />
            <Button type="submit">Submit</Button>
        </Form>);
    }
}


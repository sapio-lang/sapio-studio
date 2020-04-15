import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
export class CreateBatchPayForm extends React.Component {
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
        const amounts = new Map(this.form.amount.value.trim().split(/\r?\n/)
            .map(l => l.trim().split(" ")));
        let radix = this.form.radix.valueAsNumber;
        console.log("radix " + radix);
        if (Number.isNaN(radix)) {
            radix = 4;
        }
        console.log("radix " + radix);
        let gas = this.form.gas.valueAsNumber;
        if (Number.isNaN(gas)) {
            gas = 0;
        }
        const pairing_mode = this.form.pairing_mode.value;
        this.props.vaultman.create_batchpay({ amounts: Object.fromEntries(amounts.entries()), radix, gas, pairing_mode });
        this.props.hide();
    }
    ;
    render() {
        return (<Form onSubmit={this.handleSubmit.bind(this)}>
            <Form.Group>
                <Form.Label> Payments to Make </Form.Label>
                <Form.Control as="textarea" placeholder="bcrt1q0548jkmkzksch8hc367jm77up40yydqh87e3qa 1.4" ref={(amt) => this.form.amount = amt} rows="6" />
            </Form.Group>
            <Form.Group>
                <Form.Label> Radix </Form.Label>
                <Form.Text className="text-muted">
                    Radix -- n for n, 1 for linear, 0 for packed, -n for at most n descendants.
                    </Form.Text>
                <FormControl type="number" placeholder="4" className=" mr-sm-1" ref={r => this.form.radix = r} max="21000000" step="1" />
            </Form.Group>
            <Form.Group>
                <Form.Label> Gas Ports to Include </Form.Label>
                <Form.Text className="text-muted">
                    value must be unspecified or above or equal to 472.
                    </Form.Text>
                <FormControl type="number" placeholder="None" className=" mr-sm-1" ref={r => this.form.gas = r} min="472" max="14610" step="1" />
            </Form.Group>
            <Form.Group>
                <Form.Label> Output Sorting Method </Form.Label>
                <FormControl as="select" className=" mr-sm-2" ref={r => this.form.pairing_mode = r}>
                    <option value="AS_IS">As Is</option>
                    <option value="VALUE">Group By Value</option>
                    <option value="BALANCE_VALUE">Balance By Value</option>
                    <option value="PROBABILITY">Group By Probability</option>
                    <option value="BALANCE_PROBABILITY">Balance By Probability</option>
                    <option value="LEXICOGRAPHICAL">Lexicographical</option>
                </FormControl>
            </Form.Group>
            <Button type="submit">Submit</Button>
        </Form>);
    }
}

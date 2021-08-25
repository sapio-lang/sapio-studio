import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import Modal from 'react-bootstrap/Modal';
import { FormEventHandler } from 'react-transition-group/node_modules/@types/react';
import { ContractModel } from '../../Data/ContractManager';
import { TransactionModel } from '../../Data/Transaction';
import { txid_buf_to_string } from '../../util';

interface IProps {
    contract: ContractModel;
    show: boolean;
    hide: () => void;
}
interface IState {
    data: string;
}
export class SaveHexModal extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
    }

    static getDerivedStateFromProps(props: IProps, state: IState) {
        let non_phantoms = props.contract.txn_models.filter((item) => {
            return (
                -1 !==
                item.tx.ins.findIndex((inp) =>
                    props.contract.txid_map.has_by_txid(
                        txid_buf_to_string(inp.hash)
                    )
                )
            );
        });
        return {
            data: JSON.stringify(
                {
                    program: non_phantoms.map((t) => t.get_json()),
                },
                undefined,
                4
            ),
        };
    }
    handleSubmit: FormEventHandler = (event) => {
        event.preventDefault();
        window.electron.save_contract(this.state.data);
    };
    render() {
        return (
            <Modal show={this.props.show} onHide={this.props.hide} size="xl">
                <Modal.Header closeButton>
                    <Modal.Title>Contract JSON </Modal.Title>
                </Modal.Header>
                <Form onSubmit={(e) => this.handleSubmit(e)}>
                    <FormControl
                        name="data"
                        as="textarea"
                        type="text"
                        readOnly
                        defaultValue={this.state.data}
                        style={{ minHeight: '50vh' }}
                    />
                    <Button variant="primary" type="submit">
                        Save
                    </Button>
                </Form>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => this.props.hide()}
                    >
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

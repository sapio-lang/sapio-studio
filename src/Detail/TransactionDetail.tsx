import { Transaction } from 'bitcoinjs-lib';
import React, { ChangeEvent } from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import { TransactionModel } from '../Data/Transaction';
import { UTXOModel } from '../Data/UTXO';
import Hex from './Hex';
import { InputDetail } from "./InputDetail";
import { TXIDDetail } from './OutpointDetail';
import { OutputDetail } from "./OutputDetail";
import _ from "lodash";
interface TransactionDetailProps {
    entity: TransactionModel;
    broadcast: (a: Transaction) => Promise<any>;
    find_tx_model: (a: Buffer, b: number) => UTXOModel | null;
}
interface IState {
    broadcastable: boolean;
}
export class TransactionDetail extends React.Component<TransactionDetailProps, IState> {

    constructor(props: any) {
        super(props);
        this.props.entity.set_broadcastable_hook((b) => this.setState({ broadcastable: b }));
        this.state = { broadcastable: false };
    }
    static getDerivedStateFromProps(props: TransactionDetailProps, state: IState) {
        state.broadcastable = props.entity.is_broadcastable();
        return state;
    }

    componentWillUnmount() {
        this.props.entity.setSelected(false);
    }
    goto(x: UTXOModel | TransactionModel) {
        x.setSelected(true);
    }
    onchange_color(e:ChangeEvent<HTMLInputElement>) {
        this.props.entity.setColor(e.target.value);

    }
    onchange_purpose(e:ChangeEvent<HTMLInputElement>) {
        this.props.entity.setPurpose(e.target.value);
    }
    render() {
        const broadcast = !this.state.broadcastable ? null :
            <ListGroup variant="flush">
                <ListGroup.Item action variant="dark" onClick={() => this.props.broadcast(this.props.entity.tx)}>
                    Broadcast
            </ListGroup.Item>
            </ListGroup>;
        const outs = this.props.entity.utxo_models.map((o, i) =>
            <ListGroup.Item key={i} variant="dark">
                <OutputDetail txoutput={o} goto={() => this.goto(this.props.entity.utxo_models[i])} />
            </ListGroup.Item>);
        const ins = this.props.entity.tx.ins.map((o, i) => {
            const witnesses: Buffer[][] = this.props.entity.witness_set.map((w) => w[i]);
            console.log(witnesses);
            return <ListGroup.Item key="input-{i}" variant="dark">
                <InputDetail txinput={o}
                    goto={() => this.goto(this.props.find_tx_model(o.hash, o.index) ?? this.props.entity)}
                    witnesses={witnesses} />
            </ListGroup.Item>;
        });

        const sequences = this.props.entity.tx.ins.map((inp) => inp.sequence);
        let greatest_relative_time = 0;
        let greatest_relative_height = 0;
        let locktime_enable = false;
        for (const sequence of sequences) {
            if (sequence == 0xFFFFFFFF) continue;
            locktime_enable = true;
            const s_mask = 0xFFFF & sequence;
            if ((1 << 22) & sequence) {
                greatest_relative_time = Math.max(greatest_relative_time, s_mask);
            } else {
                greatest_relative_time = Math.max(greatest_relative_height, s_mask);
            }
        }

        greatest_relative_time *= 512;
        let relative_time_string = "None";
        greatest_relative_time /= 60 * 60;
        if (greatest_relative_time < 24 && greatest_relative_time != 0) {
            relative_time_string = greatest_relative_time.toString() + " Hours";
        } else {
            greatest_relative_time /= 24;
            if (greatest_relative_time < 14) {
                relative_time_string = greatest_relative_time.toString() + " Days";
            } else {
                greatest_relative_time /= 7;
                if (greatest_relative_time < 10) {
                    relative_time_string = greatest_relative_time.toString() + " Weeks";
                } else {
                    greatest_relative_time /= 30;
                    relative_time_string = greatest_relative_time.toString() + " Weeks";
                }
            }
        }
        const relative_blocks_string = greatest_relative_height === 0? "None":greatest_relative_height + " Blocks";


        const locktime = this.props.entity.tx.locktime;
        const as_date = new Date(1970, 0, 1);
        as_date.setSeconds(locktime);
        const lt = ((!locktime_enable) || locktime === 0) ? "None" : locktime < 500_000_000 ? "Block #" + locktime.toString() : as_date.toUTCString() + " MTP";
        // note missing horizontal
        const inner_debounce_color = _.debounce(this.onchange_color.bind(this), 30);
        const debounce_color = (e: ChangeEvent<HTMLInputElement>) => {e.persist(); inner_debounce_color(e)};
        const inner_debounce_purpose = _.debounce(this.onchange_purpose.bind(this), 30);
        const debounce_purpose = (e: ChangeEvent<HTMLInputElement>) => {e.persist(); inner_debounce_purpose(e)};
        return (<>
            {broadcast}
            <hr />

            <TXIDDetail txid={this.props.entity.get_txid()} />
            <ListGroup variant="flush">
            <ListGroup.Item variant="dark">
                    <h6>Purpose: <input defaultValue={this.props.entity.purpose} onChange={debounce_purpose}/>
                    </h6>
            </ListGroup.Item>

            <ListGroup.Item variant="dark">
                    <h6>Color: <input defaultValue={this.props.entity.color} onChange={debounce_color}/> </h6>
            </ListGroup.Item>
            <ListGroup.Item variant="dark">
            <h6>Absolute Lock Time: {lt} </h6>
            </ListGroup.Item>
            <ListGroup.Item variant="dark">
            <h6>Relative Lock Time: {relative_time_string} </h6>

            </ListGroup.Item>
            <ListGroup.Item variant="dark">
            <h6>Relative Lock Time: {relative_blocks_string} </h6>

            </ListGroup.Item>

            </ListGroup>
            <ListGroup variant="flush">
                <ListGroup.Item variant="dark">
                    <h4> Inputs</h4>

                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <ListGroup variant="flush">{ins}</ListGroup>
                </ListGroup.Item>
            </ListGroup>
            <ListGroup variant="flush">
                <ListGroup.Item variant="dark">

                    <h4>Outputs</h4>
                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <ListGroup variant="flush">{outs}</ListGroup>
                </ListGroup.Item>
            </ListGroup>
            <ListGroup>
                <ListGroup.Item variant="dark">
                    <h4> Tx Hex </h4>

                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <Hex value={this.props.entity.tx.toHex()} readOnly className="txhex"> </Hex>
                </ListGroup.Item>
            </ListGroup>
        </>);
    }
}

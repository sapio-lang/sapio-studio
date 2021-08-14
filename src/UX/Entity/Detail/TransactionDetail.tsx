import { Transaction } from 'bitcoinjs-lib';
import React, { ChangeEvent } from 'react';
import * as Bitcoin from 'bitcoinjs-lib';
import ListGroup from 'react-bootstrap/ListGroup';
import { TransactionModel, PhantomTransactionModel } from '../../../Data/Transaction';
import { UTXOModel } from '../../../Data/UTXO';
import Hex from './Hex';
import { InputDetail } from './InputDetail';
import { TXIDDetail } from './OutpointDetail';
import { OutputDetail } from './OutputDetail';
import _ from 'lodash';
import "./TransactionDetail.css";
import { sequence_convert, time_to_pretty_string } from '../../../util';
interface TransactionDetailProps {
    entity: TransactionModel;
    broadcast: (a: Transaction) => Promise<any>;
    find_tx_model: (a: Buffer, b: number) => UTXOModel | null;
}
interface IState {
    broadcastable: boolean;
    color: string;
}
export class TransactionDetail extends React.Component<
    TransactionDetailProps,
    IState
> {
    constructor(props: any) {
        super(props);
        this.props.entity.set_broadcastable_hook((b) =>
            this.setState({ broadcastable: b })
        );
        this.state = { broadcastable: false, color: this.props.entity.color };
    }
    static getDerivedStateFromProps(
        props: TransactionDetailProps,
        state: IState
    ) {
        state.broadcastable = props.entity.is_broadcastable();
        return state;
    }

    componentWillUnmount() {
        this.props.entity.setSelected(false);
    }
    goto(x: UTXOModel | TransactionModel) {
        if (!(x instanceof PhantomTransactionModel)) x.setSelected(true);
    }
    onchange_color(e: ChangeEvent<HTMLInputElement>) {
        this.setState({ color: e.target.value })
        this.props.entity.setColor(e.target.value);
    }
    onchange_purpose(e: ChangeEvent<HTMLInputElement>) {
        this.props.entity.setPurpose(e.target.value);
    }
    render() {
        const broadcast = !this.state.broadcastable ? null : (
            <ListGroup.Item
                action
                variant="dark"
                onClick={() => this.props.broadcast(this.props.entity.tx)}
            >
                Broadcast
            </ListGroup.Item>
        );
        const outs = this.props.entity.utxo_models.map((o, i) => (
            <OutputDetail
                txoutput={o}
                goto={() => this.goto(this.props.entity.utxo_models[i])}
            />
        ));
        const ins = this.props.entity.tx.ins.map((o, i) => {
            const witnesses: Buffer[][] = this.props.entity.witness_set.map(
                (w) => w[i]
            );
            return (
                <InputDetail
                    txinput={o}
                    goto={() =>
                        this.goto(
                            this.props.find_tx_model(o.hash, o.index) ??
                            this.props.entity
                        )
                    }
                    witnesses={witnesses}
                />
            );
        });

        const { greatest_relative_height, greatest_relative_time, locktime_enable, relative_time_jsx, relative_height_jsx }
            = compute_relative_timelocks(this.props.entity.tx);


        const locktime = this.props.entity.tx.locktime;
        const as_date = new Date(1970, 0, 1);
        as_date.setSeconds(locktime);
        const lt =
            !locktime_enable || locktime === 0
                ? 'None'
                : locktime < 500_000_000
                    ? 'Block #' + locktime.toString()
                    : as_date.toUTCString() + ' MTP';
        // note missing horizontal
        const inner_debounce_color = _.debounce(
            this.onchange_color.bind(this),
            30
        );
        const debounce_color = (e: ChangeEvent<HTMLInputElement>) => {
            e.persist();
            inner_debounce_color(e);
        };
        const inner_debounce_purpose = _.debounce(
            this.onchange_purpose.bind(this),
            30
        );
        const debounce_purpose = (e: ChangeEvent<HTMLInputElement>) => {
            e.persist();
            inner_debounce_purpose(e);
        };
        const absolute_lock_jsx = !locktime_enable || locktime === 0? null:
                    (<><span>Absolute Lock Time:</span><span> {lt} </span></>);
        return (
            <div className="TransactionDetail">
                {broadcast}
                <TXIDDetail txid={this.props.entity.get_txid()} />
                <div className="serialized-tx">
                    <span> Tx Hex </span>
                    <Hex
                        value={this.props.entity.tx.toHex()}
                        readOnly
                        className="txhex"
                    />
                </div>
                <div className="purpose">

                    <span>Purpose:</span>
                    <input
                        defaultValue={this.props.entity.purpose}
                        onChange={debounce_purpose}
                    />
                </div>
                <div className="color">
                    <span>Color:</span>
                    <div>
                        <input
                            defaultValue={this.props.entity.color}
                            value={this.state.color}
                            type="color"
                            onChange={debounce_color}
                        />
                        <span> {this.state.color}</span>
                    </div>
                </div>
                <div className="properties">
                    {absolute_lock_jsx}
                    {relative_height_jsx}
                    {relative_time_jsx}
                </div>
                <h4> Inputs</h4>
                <div className="inputs">
                    {ins}
                </div>
                <h4>Outputs</h4>
                <div className="outputs">

                    {outs}
                </div>
            </div>
        );
    }
}

// TODO: Make this check the input's context
function compute_relative_timelocks(tx: Transaction) {
    const sequences = tx.ins.map((inp) => inp.sequence);
    let greatest_relative_time = 0;
    let greatest_relative_height = 0;
    let locktime_enable = false;
    for (const sequence of sequences) {
        if (sequence === Bitcoin.Transaction.DEFAULT_SEQUENCE) continue;
        locktime_enable = true;
        let { relative_time, relative_height } = sequence_convert(sequence);
        greatest_relative_time = Math.max(relative_time, greatest_relative_time);
        greatest_relative_height = Math.max(relative_height, greatest_relative_height);
    }
    const relative_time_string = time_to_pretty_string(greatest_relative_time);
    const relative_time_jsx = greatest_relative_time === 0 ? null : (<><span>Relative Lock Time: </span><span>{relative_time_string} </span></>);
    const relative_height_jsx = greatest_relative_height === 0 ? null : (<><span>Relative Height: </span><span>{greatest_relative_height} Blocks</span></>);
    return { greatest_relative_height, greatest_relative_time, locktime_enable, relative_time_jsx, relative_height_jsx };
}
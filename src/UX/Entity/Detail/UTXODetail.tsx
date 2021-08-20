import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex, { ASM } from './Hex';
import {
    get_wtxid_backwards,
    pretty_amount,
    TXID,
    txid_buf_to_string,
} from '../../../util';
import { UTXOModel } from '../../../Data/UTXO';
import './UTXODetail.css';
import { OutpointDetail } from './OutpointDetail';
import { NodeModel } from '@projectstorm/react-diagrams';
import {
    PhantomTransactionModel,
    TransactionModel,
} from '../../../Data/Transaction';
import { Data, ContractModel } from '../../../Data/ContractManager';
import { QueriedUTXO } from '../../../Data/BitcoinNode';
import Button from 'react-bootstrap/esm/Button';

interface UTXODetailProps {
    entity: UTXOModel;
    fetch_utxo: (t: TXID, n: number) => Promise<QueriedUTXO|null>;
    fund_out: (a: Bitcoin.Transaction) => Promise<Bitcoin.Transaction>;
    contract: ContractModel;
    load_new_contract: (x: Data) => void;
}

interface UTXODetailState {
    flash: String | null;
}
export class UTXODetail extends React.Component<
    UTXODetailProps,
    UTXODetailState
> {
    constructor(props: UTXODetailProps) {
        super(props);
        this.state = { flash: null };
    }

    componentWillUnmount() {
        this.props.entity.setSelected(false);
    }
    goto(x: NodeModel) {
        if (!(x instanceof PhantomTransactionModel)) x.setSelected(true);
    }
    static isMock(txid_in: TXID, idx: number): boolean {
        const txid = txid_in;
        const hash = Bitcoin.crypto.sha256(new Buffer('mock:' + idx));
        return txid_buf_to_string(hash) === txid;
    }
    static update(utxo_in: UTXOModel) {
        const s: Array<UTXOModel> = [utxo_in];

        for (let count = 0; count < s.length; ++count) {
            const utxo = s[count];
            // Pop a node for processing...
            console.log('FIXING', utxo.utxo.txid, utxo.utxo.spends);
            utxo.utxo.spends.forEach((spend: TransactionModel) => {
                console.log('FIXING', spend);
                spend.tx.ins
                    .filter(
                        (inp) => txid_buf_to_string(inp.hash) === utxo.utxo.txid
                    )
                    .forEach((inp) => {
                        inp.hash = utxo.txn.tx.getHash();
                    });
                spend.tx.ins
                    .filter((inp) =>
                        UTXODetail.isMock(
                            txid_buf_to_string(inp.hash),
                            inp.index
                        )
                    )
                    .forEach((inp) => {
                        // TODO: Only modify the mock that was intended
                        inp.hash = utxo.txn.tx.getHash();
                        inp.index = utxo.utxo.index;
                    });

                spend.utxo_models.forEach((u: UTXOModel) => s.push(u));
            });
        }
    }
    async create() {
        await this.props
            .fund_out(this.props.entity.txn.tx)
            .then((funded) => {
                this.props.entity.txn.tx = funded;
                console.log('FUNDED', funded);
                UTXODetail.update(this.props.entity);

                const data = {
                    program: this.props.contract.txn_models.map((t) =>
                        t.get_json()
                    ),
                };
                this.props.load_new_contract(data);
            })
            .catch((error) => {
                this.setState({ flash: error.message });
                setTimeout(() => this.setState({ flash: null }), 3000);
            });
    }
    async query() {
        const data = await this.props.fetch_utxo(
            this.props.entity.txn.get_txid(),
            this.props.entity.utxo.index
        );
        if (!data) return;
        if (data.confirmations > 0) {
            this.props.entity.utxo.amount = 100e6 * data.value;
            this.props.entity.utxo.script = Bitcoin.address.toOutputScript(
                data.scriptPubKey.address,
                Bitcoin.networks.regtest
            );
            this.props.entity.setConfirmed(true);
            this.props.entity.sync();
            this.forceUpdate();
        }
    }
    render() {
        console.log(this);
        const decomp =
            Bitcoin.script.decompile(this.props.entity.utxo.script) ??
            Buffer.from('');
        const _script = Bitcoin.script.toASM(decomp);
        let address = 'UNKNOWN';
        try {
            address = Bitcoin.address.fromOutputScript(
                this.props.entity.utxo.script,
                Bitcoin.networks.regtest
            );
        } catch {}
        const spends = this.props.entity.utxo.spends.map((elt, i) => (
            <div key={get_wtxid_backwards(elt.tx)} className="Spend">
                <Hex value={elt.get_txid()} />
                <Button variant="link" onClick={() => this.goto(elt)}>
                    <span
                        className="glyphicon glyphicon-chevron-right"
                        style={{ color: 'green' }}
                        title="Go To The Spending Transaction"
                    ></span>
                </Button>
            </div>
        ));
        const is_mock = UTXODetail.isMock(
            this.props.entity.txn.get_txid(),
            this.props.entity.utxo.index
        );
        const creator = !is_mock ? null : (
            <Button variant="link" onClick={() => this.create()}>
                <span
                    className="glyphicon glyphicon-cloud-plus"
                    style={{ color: 'green' }}
                    title="Create Output"
                ></span>
            </Button>
        );
        const check_exists = is_mock ? null : (
            <Button variant="link" onClick={() => this.query()}>
                <span
                    className="glyphicon glyphicon-cloud-download"
                    style={{ color: 'purple' }}
                    title="Query Node for this Output"
                ></span>
            </Button>
        );
        const title =
            this.props.entity.txn instanceof PhantomTransactionModel
                ? 'External UTXO'
                : pretty_amount(this.props.entity.utxo.amount);

        return (
            <div className="UTXODetail">
                {this.state.flash}
                <div>
                    {creator}
                    {check_exists}
                </div>
                <p>{title}</p>

                <OutpointDetail
                    txid={this.props.entity.txn.get_txid()}
                    n={this.props.entity.utxo.index}
                    onClick={() => this.goto(this.props.entity.txn)}
                />
                <div>
                    Address: <ASM className="txhex" readOnly value={address} />
                </div>
                <div>Spent By: {spends}</div>
            </div>
        );
    }
}

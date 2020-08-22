import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex, { ASM } from './Hex';
import { get_wtxid_backwards, pretty_amount, TXID, txid_buf_to_string } from '../util';
import { UTXOModel } from '../Data/UTXO';
import "./UTXODetail.css";
import { OutpointDetail } from './OutpointDetail';
import { NodeModel } from '@projectstorm/react-diagrams';
import { PhantomTransactionModel, TransactionModel } from '../Data/Transaction';
import { Data, ContractModel } from '../Data/ContractManager';

interface UTXODetailProps {
    entity: UTXOModel;
    fetch_utxo: (t: TXID, n: number) => Promise<any>;
    fund_out: (a: Bitcoin.Transaction) => Promise<Bitcoin.Transaction>;
    contract: ContractModel;
    load_new_contract: (x: Data) => void;
}
export class UTXODetail extends React.Component<UTXODetailProps> {

    componentWillUnmount() {
        this.props.entity.setSelected(false);
    }
    goto(x:NodeModel) {
        if (!(x instanceof PhantomTransactionModel))
            x.setSelected(true);
    }
    static isMock(txid_in: TXID, idx: number) : boolean{
        const txid = txid_in;
        const hash = Bitcoin.crypto.sha256(new Buffer("mock:"+ (idx)   ));
        return hash.toString('hex') == txid;
    }
    static update(utxo_in: UTXOModel) {
        const s : Array<UTXOModel> =[utxo_in];


        for (let count = 0; count < s.length; ++count) {
            const utxo = s[count];
            // Pop a node for processing...
            console.log("FIXING", utxo.utxo.txid, utxo.utxo.spends);
            utxo.utxo.spends.forEach((spend: TransactionModel) => {
                console.log("FIXING", spend);
                spend.tx.ins.filter((inp) =>
                    txid_buf_to_string(inp.hash) === utxo.utxo.txid).forEach((inp) => {
                        inp.hash = utxo.txn.tx.getHash();
                    }
                    );
                spend.tx.ins.filter((inp) => UTXODetail.isMock(txid_buf_to_string(inp.hash), inp.index))
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
        const funded = await this.props.fund_out(this.props.entity.txn.tx);
        this.props.entity.txn.tx = funded;
        UTXODetail.update(this.props.entity);

        const data = { program: this.props.contract.txn_models.map((t) => t.get_json()) };
        this.props.load_new_contract(data);
    }
    render() {
        console.log(this);
        const decomp = Bitcoin.script.decompile(this.props.entity.utxo.script) ?? new Buffer("");
        const script = Bitcoin.script.toASM(decomp);
        let address = "UNKNOWN";
        try {
            address = Bitcoin.address.fromOutputScript(this.props.entity.utxo.script,Bitcoin.networks.regtest);
        } catch {}
        if (this.props.entity.txn instanceof PhantomTransactionModel) {
            const is_mock = UTXODetail.isMock(this.props.entity.txn.get_txid(), this.props.entity.utxo.index);
           const creator = !is_mock ? null :
                <ListGroup.Item action variant="success" onClick={()=>this.create()}>Create</ListGroup.Item>;
            const check_exists = is_mock?null:
                <ListGroup.Item action variant="secondary">Query</ListGroup.Item>;
        
            const spends = this.props.entity.utxo.spends.map((elt, i) => <ListGroup.Item key={get_wtxid_backwards(elt.tx)} variant="dark">
                <ListGroup horizontal className="Spend">
                    <ListGroup.Item variant="dark">
                        <Hex value={elt.get_txid()} />
                    </ListGroup.Item>
                    <ListGroup.Item action variant="success" onClick={() => this.goto(elt)}> Go</ListGroup.Item>

                </ListGroup>
            </ListGroup.Item>);
            return (<div className="UTXODetail">
                <h1>External UTXO</h1>
                <ListGroup>
                    {creator}
                    {check_exists}
                </ListGroup>
                {address}
                <ListGroup>
                    <ListGroup.Item variant="dark">
                        <h4>Spends</h4>
                    </ListGroup.Item>
                    <ListGroup.Item variant="dark">
                        <ListGroup variant="flush">
                            {spends}
                        </ListGroup>
                    </ListGroup.Item>
                </ListGroup>
            </div>);

        } else {
        const spends = this.props.entity.utxo.spends.map((elt, i) => <ListGroup.Item key={get_wtxid_backwards(elt.tx)} variant="dark">
            <ListGroup horizontal className="Spend">
                <ListGroup.Item variant="dark">
                    <Hex value={elt.get_txid()} />
                </ListGroup.Item>
                <ListGroup.Item action variant="success" onClick={() => this.goto(elt)}> Go</ListGroup.Item>

            </ListGroup>
        </ListGroup.Item>);
        return (<div className="UTXODetail">
            <h1>{pretty_amount(this.props.entity.utxo.amount)}</h1>
            <hr></hr>
            <OutpointDetail txid={this.props.entity.txn.get_txid()} n={this.props.entity.utxo.index} 
                onClick= {() => this.goto(this.props.entity.txn)}
            />

            <ListGroup>
                <ListGroup.Item variant="dark">
                    <h4> Address </h4>
                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <ASM className="txhex" readOnly value={address} />
                </ListGroup.Item>
            </ListGroup>
            <ListGroup>
                <ListGroup.Item variant="dark">
                    <h4>Spends</h4>

                </ListGroup.Item>
                <ListGroup.Item variant="dark">
                    <ListGroup variant="flush">
                        {spends}
                    </ListGroup>

                </ListGroup.Item>
            </ListGroup>
        </div>);
        }
    }
}

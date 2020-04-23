import * as Bitcoin from 'bitcoinjs-lib';
import React from 'react';
import ListGroup from 'react-bootstrap/ListGroup';
import Hex, { ASM } from '../Hex';
import { get_wtxid_backwards, pretty_amount } from '../util';
import { UTXOModel } from '../UTXO';
import "./UTXODetail.css";
import { OutpointDetail } from './OutpointDetail';
import { NodeModel } from '@projectstorm/react-diagrams';

interface UTXODetailProps {
    entity: UTXOModel;
}
export class UTXODetail extends React.Component<UTXODetailProps> {

    componentWillUnmount() {
        this.props.entity.setSelected(false);
    }
    goto(x:NodeModel) {
        x.setSelected(true);
    }
    render() {
        console.log(this);
        const decomp = Bitcoin.script.decompile(this.props.entity.utxo.script) ?? new Buffer("");
        const script = Bitcoin.script.toASM(decomp);
        const address = Bitcoin.address.fromOutputScript(this.props.entity.utxo.script,Bitcoin.networks.regtest);
        const spends = this.props.entity.utxo.spends.map((elt, i) => <ListGroup.Item key={get_wtxid_backwards(elt.tx)}>
            <ListGroup horizontal className="Spend">
                <ListGroup.Item>
                    <Hex value={elt.get_txid()} />
                </ListGroup.Item>
                <ListGroup.Item action variant="primary" onClick={() => this.goto(elt)}> Go</ListGroup.Item>

            </ListGroup>
        </ListGroup.Item>);
        return (<div className="UTXODetail">
            <h1>{pretty_amount(this.props.entity.utxo.amount)}</h1>
            <hr></hr>
            <OutpointDetail txid={this.props.entity.txn.get_txid()} n={this.props.entity.utxo.index} 
                onClick= {() => this.goto(this.props.entity.txn)}
            />

            <ListGroup>
                <ListGroup.Item>
                    <h4> Address </h4>
                </ListGroup.Item>
                <ListGroup.Item>
                    <ASM className="txhex" readOnly value={address} />
                </ListGroup.Item>
            </ListGroup>
            <ListGroup>
                <ListGroup.Item>
                    <h4>Spends</h4>

                </ListGroup.Item>
                <ListGroup.Item>
                    <ListGroup variant="flush">
                        {spends}
                    </ListGroup>

                </ListGroup.Item>
            </ListGroup>
        </div>);
    }
}

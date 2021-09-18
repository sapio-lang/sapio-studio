import React from 'react';
import { FormEventHandler } from 'react-transition-group/node_modules/@types/react';
import { ContractModel } from '../../Data/ContractManager';
import { TXIDAndWTXIDMap, txid_buf_to_string } from '../../util';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Button, TextField, Typography } from '@mui/material';

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
                    TXIDAndWTXIDMap.has_by_txid(
                        props.contract.txid_map,
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
    handleSave = () => {
        window.electron.save_contract(this.state.data);
    };
    render() {
        return (
            <Dialog open={this.props.show} onClose={this.props.hide} fullScreen>
                <DialogTitle>Contract JSON</DialogTitle>
                <DialogContent>
                    <form onSubmit={(e) => e.preventDefault()}>
                        <TextField
                            name="data"
                            multiline
                            fullWidth
                            type="text"
                            aria-readonly
                            InputProps={{
                                readOnly: true,
                            }}
                            defaultValue={this.state.data}
                            style={{ minHeight: '50vh' }}
                        />
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.handleSave()}>Save</Button>
                    <Button onClick={() => this.props.hide()}>Close</Button>
                </DialogActions>
            </Dialog>
        );
    }
}

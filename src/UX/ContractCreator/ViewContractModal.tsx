import { Button, Select } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React from 'react';
import { useDispatch } from 'react-redux';
import { BitcoinNodeManager } from '../../Data/BitcoinNode';
import { close_modal } from '../ModalSlice';

export function ViewContractModal(props: {
    show: boolean;
    bitcoin_node_manager: BitcoinNodeManager;
}) {
    const dispatch = useDispatch();
    return (
        <Dialog open={props.show} onClose={() => dispatch(close_modal())}>
            <DialogTitle>View Existing Contract</DialogTitle>
            <DialogContent>
                <form>
                    <Select
                        placeholder="Existing Contract"
                        className=" mr-sm-2"
                    />
                    <Button type="submit">View</Button>
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => dispatch(close_modal())}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

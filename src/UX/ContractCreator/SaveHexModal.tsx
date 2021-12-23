import { Button, TextField } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useDispatch } from 'react-redux';
import { ContractModel } from '../../Data/ContractManager';
import { TXIDAndWTXIDMap, txid_buf_to_string } from '../../util';
import { close_modal } from '../ModalSlice';

interface IProps {
    contract: ContractModel;
    show: boolean;
}
export function SaveHexModal(props: IProps) {
    const dispatch = useDispatch();
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
    const data = JSON.stringify(
        {
            program: non_phantoms.map((t) => t.get_json()),
        },
        undefined,
        4
    );
    const handleSave = () => {
        window.electron.save_contract(data);
    };
    return (
        <Dialog
            open={props.show}
            onClose={() => dispatch(close_modal())}
            fullScreen
        >
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
                        defaultValue={data}
                        style={{ minHeight: '50vh' }}
                    />
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => handleSave()}>Save</Button>
                <Button onClick={() => dispatch(close_modal())}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

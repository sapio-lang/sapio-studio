import { Button, TextField } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { ContractModel } from '../../Data/ContractManager';
import { TXIDAndWTXIDMap, txid_buf_to_string } from '../../util';

interface IProps {
    contract: ContractModel;
    show: boolean;
    hide: () => void;
}
export function SaveHexModal(props: IProps) {
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
        <Dialog open={props.show} onClose={props.hide} fullScreen>
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
                <Button onClick={() => props.hide()}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

import { Button } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useDispatch, useSelector } from 'react-redux';
import {
    selectSelectedAPI,
    select_api,
    showAPIs,
    show_apis,
} from './ContractCreatorSlice';
import { PluginSelector } from './SapioPluginPicker/PluginSelector';

export function CreateContractModal() {
    const show = useSelector(showAPIs);
    const dispatch = useDispatch();
    const selected = useSelector(selectSelectedAPI);
    const unselect =
        selected === null ? null : (
            <Button onClick={() => dispatch(select_api(null))}>Back</Button>
        );

    if (!show) return null;
    return (
        <Dialog
            open={show}
            onClose={() => dispatch(show_apis(false))}
            fullScreen
        >
            <DialogTitle>Applications</DialogTitle>
            <DialogContent>
                <PluginSelector />
            </DialogContent>
            <DialogActions>
                {unselect}
                <Button onClick={() => dispatch(show_apis(false))}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}

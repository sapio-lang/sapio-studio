import { Button } from '@material-ui/core';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
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

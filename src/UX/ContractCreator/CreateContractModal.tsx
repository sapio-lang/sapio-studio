import { Button, Paper, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { selectAPI, select_api } from './ContractCreatorSlice';
import { PluginSelector } from './SapioPluginPicker/PluginSelector';
import * as React from 'react';
import './CreateContractModal.css';
function CreateContractModalInner() {
    const dispatch = useDispatch();
    const selected = useSelector(selectAPI);
    const unselect =
        selected === null ? null : (
            <Button onClick={() => dispatch(select_api(null))}>Back</Button>
        );

    return (
        <Paper square={true} className="PluginPage">
            <div>
                {unselect}
                <Typography variant="h3">Applications</Typography>
                <PluginSelector />
            </div>
        </Paper>
    );
}

export const CreateContractModal = React.memo(CreateContractModalInner);

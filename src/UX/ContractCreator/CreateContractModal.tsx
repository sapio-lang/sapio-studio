import { Button, Paper, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { selectSelectedAPI, select_api } from './ContractCreatorSlice';
import { PluginSelector } from './SapioPluginPicker/PluginSelector';
import * as React from 'react';
import './CreateContractModal.css';
export function CreateContractModal() {
    const dispatch = useDispatch();
    const selected = useSelector(selectSelectedAPI);
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

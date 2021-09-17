import React from 'react';
import { useDispatch } from 'react-redux';
import { load_new_model } from '../../AppSlice';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { Button, TextField, Typography } from '@material-ui/core';

const FIELD_NAME = 'data';
export function LoadHexModal(props: { hide: () => void; show: boolean }) {
    const formRef = React.useRef<null | HTMLFormElement>(null);
    const dispatch = useDispatch();
    function handleSubmit() {
        if (formRef.current) {
            const elt = formRef.current.elements.namedItem(FIELD_NAME);
            if (elt) {
                // TODO: More robust type corercion
                if ((elt as any).value) {
                    dispatch(load_new_model(JSON.parse((elt as any).value)));
                }
            }
        }
        props.hide();
    }
    return (
        <Dialog open={props.show} onClose={props.hide}>
            <DialogTitle>Paste Hex JSON</DialogTitle>

            <DialogContent>
                <DialogContentText>
                    <p>The data pasted should be of format:</p>
                    <p>{` Array<{ psbt: string, hex: string, color?: string, label?: string, utxo_metadata?: Array<{color: string, label:string} | null>>`}</p>
                </DialogContentText>
                <form ref={formRef}>
                    <TextField name={FIELD_NAME} multiline fullWidth />
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleSubmit}>Load</Button>
                <Button onClick={() => props.hide()}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

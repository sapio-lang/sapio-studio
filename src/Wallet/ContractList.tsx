import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Delete } from '@mui/icons-material';
import { DataGrid, GridActionsCellItem, GridColumns } from '@mui/x-data-grid';
import React from 'react';
import { useDispatch } from 'react-redux';
import { open_contract_directory, switch_showing } from '../AppSlice';

export function ContractList(props: { idx: number; value: number }) {
    const dispatch = useDispatch();
    const [contracts, set_contracts] = React.useState<string[]>([]);
    const [to_delete, set_to_delete] = React.useState<string | null>(null);
    const [trigger_now, set_trigger_now] = React.useState(0);
    React.useEffect(() => {
        let cancel = false;
        const update = async () => {
            if (cancel) return;

            try {
                const list =
                    await window.electron.sapio.compiled_contracts.list();
                set_contracts(list);
            } catch (err) {
                console.error(err);
                set_contracts([]);
            }
            setTimeout(update, 5000);
        };

        update();
        return () => {
            cancel = true;
        };
    }, [trigger_now]);
    const contract_rows = contracts.map((id) => {
        const [mod, args, time] = id.split('-');
        return {
            id,
            module,
            args,
            time: new Date(parseInt(time!)),
        };
    });
    const delete_contract = (fname: string | number) => {
        if (typeof fname === 'number') return;
        set_to_delete(fname);
    };

    const columns: GridColumns = [
        { field: 'mod', headerName: 'Module', width: 130, type: 'text' },
        { field: 'args', headerName: 'Args Hash', width: 130 },
        { field: 'time', headerName: 'Time', width: 130, type: 'date' },
        {
            field: 'actions',
            type: 'actions',
            width: 80,
            getActions: (params) => [
                <GridActionsCellItem
                    key="delete"
                    icon={<Delete />}
                    label="Delete"
                    onClick={() => delete_contract(params.id)}
                />,
                <GridActionsCellItem
                    key="open-folder"
                    icon={<VisibilityIcon />}
                    label="Open"
                    onClick={() => {
                        dispatch(switch_showing('ContractViewer'));
                        dispatch(
                            open_contract_directory(
                                typeof params.id === 'number' ? '' : params.id
                            )
                        );
                    }}
                />,
            ],
        },
    ];
    return (
        <div hidden={props.idx !== props.value} className="ContractList">
            <Dialog
                onClose={() => set_to_delete(null)}
                open={to_delete !== null}
            >
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Confirm deletion of &quot;{to_delete}&quot;? File will
                        be in your trash folder.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        color="warning"
                        onClick={(ev) => {
                            to_delete &&
                                window.electron.sapio.compiled_contracts.trash(
                                    to_delete
                                );
                            set_to_delete(null);
                            set_trigger_now(trigger_now + 1);
                        }}
                    >
                        Delete
                    </Button>
                    <Button onClick={() => set_to_delete(null)}>Cancel</Button>
                </DialogActions>
            </Dialog>
            {props.idx === props.value && (
                <div className="ContractListInner">
                    <div></div>
                    <div>
                        <DataGrid
                            rows={contract_rows}
                            columns={columns}
                            pageSize={10}
                            rowsPerPageOptions={[5]}
                            disableColumnSelector
                            disableSelectionOnClick
                        />
                    </div>
                    <div></div>
                </div>
            )}
        </div>
    );
}

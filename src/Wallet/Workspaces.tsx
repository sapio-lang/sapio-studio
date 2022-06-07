import { Add, Delete, FolderOpen } from '@mui/icons-material';
import { Button, Typography } from '@mui/material';
import {
    DataGrid,
    GridActionsCellItem,
    GridColumns,
    GridToolbarContainer,
} from '@mui/x-data-grid';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DeleteDialog } from './DeleteDialog';
import { NewWorkspace } from './NewWorkspace';
import {
    selectWorkspace,
    switch_wallet_tab,
    switch_workspace,
} from './Slice/Reducer';

export function Workspaces(props: { idx: number; value: number }) {
    const dispatch = useDispatch();
    const workspace = useSelector(selectWorkspace);
    const [workspaces, set_workspaces] = React.useState<string[]>([]);
    const [to_delete, set_to_delete] = React.useState<string | null>(null);
    const [trigger_now, set_trigger_now] = React.useState(0);
    const [show_new_workspace, set_new_workspace] = React.useState(false);
    const hide_new_workspace = () => {
        set_new_workspace(false);
    };
    const reload = () => {
        set_trigger_now(trigger_now + 1);
    };
    React.useEffect(() => {
        let cancel = false;
        const update = async () => {
            if (cancel) return;

            try {
                const list = await window.electron.sapio.workspaces.list();
                set_workspaces(list);
            } catch (err) {
                console.error(err);
                set_workspaces([]);
            }
            setTimeout(update, 5000);
        };

        update();
        return () => {
            cancel = true;
        };
    }, [trigger_now]);
    const contract_rows = workspaces.map((id) => {
        return {
            id,
            name: id,
        };
    });
    const delete_workspace = (fname: string | number) => {
        if (typeof fname === 'number') return;
        set_to_delete(fname);
    };

    const columns: GridColumns = [
        {
            field: 'actions-load',
            type: 'actions',
            flex: 0.2,
            getActions: (params) => [
                <GridActionsCellItem
                    key="open-folder"
                    icon={<FolderOpen />}
                    label="Open"
                    onClick={() => {
                        // TODO: Better tabbing?
                        dispatch(switch_wallet_tab(3));
                        typeof params.id === 'string' &&
                            dispatch(switch_workspace(params.id));
                    }}
                />,
            ],
        },
        {
            field: 'name',
            headerName: 'Name',
            width: 100,
            type: 'text',
            flex: 1,
        },
        {
            field: 'actions-delete',
            type: 'actions',
            flex: 0.2,
            getActions: (params) => [
                <GridActionsCellItem
                    key="delete"
                    icon={<Delete />}
                    label="Delete"
                    onClick={() => delete_workspace(params.id)}
                />,
            ],
        },
    ];
    function CustomToolbar() {
        return (
            <GridToolbarContainer>
                <Button onClick={() => set_new_workspace(true)}>
                    New Workspace<Add></Add>
                </Button>
                <Typography>Currenty Active Workspace: {workspace} </Typography>
            </GridToolbarContainer>
        );
    }
    return (
        <div hidden={props.idx !== props.value} className="WorkspaceList">
            <NewWorkspace
                show={show_new_workspace}
                hide={hide_new_workspace}
                reload={reload}
            />
            <DeleteDialog
                set_to_delete={() => set_to_delete(null)}
                to_delete={to_delete !== null ? ['workspace', to_delete] : null}
                reload={reload}
            />
            {props.idx === props.value && (
                <div className="WorkspaceListInner">
                    <div></div>
                    <div>
                        <DataGrid
                            components={{
                                Toolbar: CustomToolbar,
                            }}
                            rows={contract_rows}
                            columns={columns}
                            disableExtendRowFullWidth={false}
                            columnBuffer={3}
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

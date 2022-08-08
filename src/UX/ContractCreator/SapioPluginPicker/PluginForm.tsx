import React from 'react';

import { Button } from '@mui/material';
import Form, { ISubmitEvent } from '@rjsf/core';
import { create_contract_of_type, switch_showing } from '../../../AppSlice';
import { useAppDispatch } from '../../../Store/store';
import { show_apis } from '../ContractCreatorSlice';
import './PluginForm.css';
import { logo_image, Plugin } from './PluginTile';

interface PluginFormProps {
    app: Plugin;
}
export function PluginForm(props: PluginFormProps) {
    const dispatch = useAppDispatch();
    const handleSubmit = async (event: ISubmitEvent<any>, type: string) => {
        const formData = event.formData;
        dispatch(switch_showing('ContractViewer'));
        await dispatch(
            create_contract_of_type(type, null, JSON.stringify(formData))
        );
        dispatch(show_apis(false));
    };
    const [data, set_data] = React.useState({});
    const handleClick = async () => {
        const s = await navigator.clipboard.readText();
        set_data(JSON.parse(s));
    };
    const copyInput = () => {
        navigator.clipboard.writeText(JSON.stringify(props.app.api));
    };
    return (
        <div className="PluginForm">
            <div></div>
            <div>
                {logo_image(props.app)}
                <Button onClick={handleClick}>Paste</Button>
                <Button onClick={copyInput}>Copy Input Schema</Button>
                <Form
                    formData={data}
                    schema={props.app.api}
                    onSubmit={(e: ISubmitEvent<any>) =>
                        handleSubmit(e, props.app.key)
                    }
                ></Form>
            </div>
            <div></div>
        </div>
    );
}

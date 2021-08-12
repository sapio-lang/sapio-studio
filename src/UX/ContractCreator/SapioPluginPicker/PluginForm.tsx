import React from 'react';
import Form, { ISubmitEvent } from '@rjsf/core';
import { CompilerServer } from '../../../Compiler/ContractCompilerServer';

export interface PluginAPI {
    title: string;
}
interface PluginFormProps {
    app: PluginAPI;
    compiler: CompilerServer;
    load_new_model: any;
    hide: () => void;
    deselect: () => void;
}
export class PluginForm extends React.Component<PluginFormProps> {
    render() {
        return (
            <div style={{ padding: '20px' }}>
                <label>Amount To Send (Bitcoin)</label><br />
                <input type="number"></input>
                <hr />
                <Form
                    schema={this.props.app}
                    onSubmit={(e: ISubmitEvent<any>) => this.handleSubmit(e, this.props.app.title)}
                ></Form>
            </div>
        );
    }
    async handleSubmit(event: ISubmitEvent<any>, type: string) {
        let formData = event.formData;
        const compiler = this.props.compiler;
        await compiler.create(type, 0, formData);
        this.props.hide();
    }
}

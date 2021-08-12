import React from 'react';
import Button from 'react-bootstrap/Button';
import Form, { ISubmitEvent } from '@rjsf/core';
import './AppSelector.css';
import { AppTile } from './AppTile';
import { CompilerServer } from '../../../Compiler/ContractCompilerServer';
interface CreateAPI {
    title: string,
}
export interface Application {
    api: CreateAPI;
    name: string;
    key: string;
    logo: string;
}


interface ShowAppProps {
    app: CreateAPI;
    compiler: CompilerServer;
    load_new_model: any;
    hide: () => void;
    deselect: () => void;
}
class ShowApp extends React.Component<ShowAppProps> {
    render() {
        return (
            <div style={{ padding: '20px' }}>
                <label>Amount To Send (Bitcoin)</label><br />
                <input type="number"></input>
                <hr />
                <Form
                    schema={this.props.app}
                    onSubmit={(e: ISubmitEvent<any>) =>
                        this.handleSubmit(e, this.props.app.title)
                    }
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

interface IProps {
    applications: Map<string, Application>;
    compiler: CompilerServer;
    load_new_model: any;
    hide: () => void;
}
interface IState {
    selected: string | null;
}
export class AppSelector extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            selected: null,
        };
    }
    deselect() {
        this.setState({ selected: null });
    }
    select(key: string) {
        this.setState({ selected: key });
    }
    render() {
        console.log(this.props.applications);
        let tiles = Array.from(this.props.applications, ([name, app], i) => (
            <AppTile
                app={app}
                parent={this}
            />
        ));
        if (this.state.selected === null) {
            return (
                <div className="AppSelectorGrid">
                    <div className="back"></div>
                    <div className={"middle"}>{tiles}</div>
                    <div className="forward"></div>
                </div>
            );
        } else {
            return (
                <div>

                    <Button
                        onClick={() => this.deselect()}
                        variant={'secondary'}
                    >
                        Back
                    </Button>
                    <ShowApp
                        app={this.props.applications.get(this.state.selected)!.api}
                        hide={this.props.hide}
                        compiler={this.props.compiler}
                        load_new_model={this.props.load_new_model}
                        deselect={this.deselect.bind(this)}
                    />
                </div>
            );
        }
    }
}

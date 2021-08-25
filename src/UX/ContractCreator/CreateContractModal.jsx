import Modal from 'react-bootstrap/Modal';
import { PluginSelector } from './SapioPluginPicker/PluginSelector';

export function CreateContractModal(props) {
    if (!props.dynamic_forms) return null;
    return (
        <Modal show={props.show} onHide={props.hide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title> Applications </Modal.Title>
            </Modal.Header>

            <PluginSelector
                hide={props.hide}
                applications={props.dynamic_forms}
                export
                compiler={props.compiler}
            />
        </Modal>
    );
}

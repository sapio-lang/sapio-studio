import Modal from 'react-bootstrap/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { selectAPIs, showAPIs, show_apis } from './ContractCreatorSlice';
import { PluginSelector } from './SapioPluginPicker/PluginSelector';

export function CreateContractModal() {
    const show = useSelector(showAPIs);
    const dispatch = useDispatch();
    if (!show) return null;
    return (
        <Modal show={show} onHide={() => dispatch(show_apis(false))} size="lg">
            <Modal.Header closeButton>
                <Modal.Title> Applications </Modal.Title>
            </Modal.Header>
            <PluginSelector />
        </Modal>
    );
}

/// <reference types="vite/client" />
import type { StudioAPI } from '../shared/studio';

declare global {
    interface Window {
        studio?: StudioAPI;
    }
}

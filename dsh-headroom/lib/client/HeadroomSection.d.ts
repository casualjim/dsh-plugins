import type { ReactNode } from 'react';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import { decodeHeadroomSection, type HeadroomSectionValue } from './section-model.js';
export interface HeadroomSectionProps {
    readonly scope: SettingsScope<HeadroomSectionValue>;
}
/**
 * The Headroom settings page: enabled toggle, proxy URL, and output mode.
 * Values ride the host settings namespace through the injected scope; writes
 * are applied live by the host half and persisted to settings.yaml.
 */
export declare function HeadroomSection({ scope }: HeadroomSectionProps): ReactNode;
export { decodeHeadroomSection };

import { type ReactNode } from 'react';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import { type HeadroomSectionValue } from './section-model.js';
export interface HeadroomCardProps {
    readonly scope: SettingsScope<HeadroomSectionValue>;
}
/**
 * Headroom plugin card for the Plugins settings tab: staged edits over the
 * `headroom` settings namespace, saved field-by-field through the scope.
 */
export declare function HeadroomCard({ scope }: HeadroomCardProps): ReactNode;

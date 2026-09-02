/**
 * dsh-fleet — Settings section (settings.section, first-party pattern from
 * ui-settings-models: slots.inject -> slots.register({id, order, label}, Comp)).
 *
 * Page: this machine's pairing code (copy), pair-a-device paste box, device
 * list with online dots and remove. Data via /api/dsh-fleet/*.
 */
import * as React from "react";
export declare function FleetSection(props: {
    close?: () => void;
}): React.ReactElement;

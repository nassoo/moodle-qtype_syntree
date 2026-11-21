/**
 * Syntax Tree Editor: translatable UI strings (Moodle lang strings with English fallback).
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
const defaults: Record<string, string> = {
    ui_import_bracket_placeholder: 'Import Bracket Notation...',
    ui_copy_title: 'Copy to clipboard',
    ui_copy: 'Copy',
    ui_copied: 'Copied!',
    ui_clear_input_title: 'Clear input',
    ui_import_bracket: 'Import Bracket',
    ui_export_bracket: 'Export Bracket',
    ui_clear_screen: 'Clear Screen',
    ui_help: '? Help',
    ui_toggle_toolbars: 'Toggle Toolbars (Hide/Show)',
    ui_modal_dnd_title: 'Node Action',
    ui_modal_dnd_question: 'What should happen with the dragged node {$a->source} and the target {$a->target}?',
    ui_dnd_child1_default: '↳ 1 becomes child of 2',
    ui_dnd_child2_default: '↳ 2 becomes child of 1',
    ui_dnd_child1: '↳ {$a->source} (dragged node) becomes child of {$a->target} (target)',
    ui_dnd_child2: '↳ {$a->target} (target) becomes child of {$a->source} (dragged node)',
    ui_dnd_swap: '⇄ Swap nodes',
    ui_cancel: 'Cancel',
    ui_modal_delete_title: 'Delete Node',
    ui_modal_delete_question: "Node '{$a}' has children. How to proceed?",
    ui_delete_keep: 'Delete node, keep children',
    ui_delete_cascade: 'Delete node AND all children',
    ui_modal_help_title: 'Help & Instructions',
    ui_close: 'Close',
    ui_loading_instructions: 'Loading instructions...',
    ui_guide_load_error: 'Error: Could not load instructions. Please check your connection.',
    ui_disconnected_warning: '⚠️ Warning: The tree is not fully connected — some nodes are isolated!',
    ui_invalid_bracket: 'Invalid bracket notation structure.',
    ui_node_label_placeholder: 'Label',
    ui_node_phrase_placeholder: 'Phrase',
    ui_node_word_placeholder: 'Word',
    ui_fab_undo: 'Undo (Ctrl+Z)',
    ui_fab_redo: 'Redo (Ctrl+Y)',
    ui_fab_zoom_in: 'Zoom In (Ctrl + + / Ctrl + Scroll)',
    ui_fab_zoom_out: 'Zoom Out (Ctrl + - / Ctrl + Scroll)',
    ui_fab_reset_zoom: 'Reset Zoom (Ctrl + 0)',
    ui_fab_center_view: 'Center View (Double-click background)',
};

const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => htmlEscapeMap[ch]);
}

export function t(key: string, a?: string | number | Record<string, string>): string {
    const mUtil = typeof window !== 'undefined' ? (window as any).M?.util : undefined;
    if (mUtil && typeof mUtil.get_string === 'function') {
        const result = mUtil.get_string(key, 'qtype_syntree', a);
        if (typeof result === 'string' && !result.startsWith('[[')) {
            return result;
        }
    }

    if (!Object.prototype.hasOwnProperty.call(defaults, key)) {
        return key;
    }

    let text = defaults[key];
    if (a !== undefined) {
        if (typeof a === 'object' && a !== null) {
            text = text.replace(/\{\$a->([a-zA-Z0-9_]+)\}/g, (match, name) =>
                Object.prototype.hasOwnProperty.call(a, name) ? String(a[name]) : match
            );
        } else {
            text = text.replace(/\{\$a\}/g, () => String(a));
        }
    }
    return text;
}

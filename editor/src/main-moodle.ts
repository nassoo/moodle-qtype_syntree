/**
 * Syntax Tree Editor: entry point of the Moodle build (initSyntaxTreeEditor).
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
import './style-moodle.css';
import { TreeRenderer } from './core/TreeRenderer';
import { TreeManager } from './core/TreeManager';
import { t, escapeHtml } from './core/i18n';

// Global registry for help modals to allow external triggers (e.g. from Moodle form headers)
const helpRegistry: Record<string, { modal: HTMLElement, load: () => void }> = {};

// A quiz page can hold several editors; the one clicked last receives the keyboard shortcuts.
let activeShortcutEditor: string | null = null;
(window as any).openSyntreeHelp = (containerId: string) => {
    const entry = helpRegistry[containerId];
    if (entry) {
        entry.modal.classList.remove('hidden');
        entry.load();
    } else {
        // Fallback: try to find any first registered help if ID is generic
        const firstId = Object.keys(helpRegistry)[0];
        if (firstId) {
            helpRegistry[firstId].modal.classList.remove('hidden');
            helpRegistry[firstId].load();
        }
    }
};


// Global function exposed to Moodle via window object
(window as any).initSyntaxTreeEditor = function (
    arg1: any,
    hiddenInputId?: string,
    mode?: 'teacher' | 'student',
    _initialDataParam?: string,
    allowtraces?: any,
    _paramIsReadOnly?: any,
    allowimport?: any
) {
    let params: any = {};

    if (typeof arg1 === 'object' && arg1 !== null) {
        // New object-based call
        params = arg1;
    } else {
        // Fallback for positional arguments
        params = {
            containerId: arg1,
            hiddenInputId,
            mode,
            initialData: _initialDataParam,
            allowtraces,
            readonly: _paramIsReadOnly,
            allowimport
        };
    }

    // Moodle's AMD often lowercases everything
    const getParam = (camel: string, lower: string) => params[camel] !== undefined ? params[camel] : params[lower];

    const containerId = getParam('containerId', 'containerid');
    const inputId = getParam('hiddenInputId', 'inputid') || getParam('inputId', 'inputid');
    const _initialData = (getParam('initialData', 'initialdata') || "").trim();

    // Robust truthy check
    const isTrue = (val: any) => {
        if (val === true || val === 1 || val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
        if (typeof val === 'string' && val.toLowerCase().trim() === 'true') return true;
        return false;
    };

    try {
        const container = document.getElementById(containerId);
        const hiddenInput = document.getElementById(inputId) as HTMLInputElement;

        if (!container) {
            console.error("SyntaxTreeEditor: Container not found:", containerId);
            return;
        }

        // Fallback to data attributes if params are missing (for cached JS issues)
        const ds = container.dataset || {};
        const _mode = (getParam('mode', 'mode') || ds.mode || 'student').toLowerCase();
        const allowTraces = isTrue(getParam('allowTraces', 'allowtraces')) || isTrue(ds.allowtraces);
        const allowImport = isTrue(getParam('allowImport', 'allowimport')) || isTrue(ds.allowimport);
        const isReadOnly = isTrue(getParam('readonly', 'readonly')) || isTrue(ds.readonly);


        if (!hiddenInput) {
            console.error("SyntaxTreeEditor: Hidden input not found:", inputId);
            return;
        }

        const treeContainerId = 'moodle-tree-container-' + containerId;

        // Set up the UI container
        const layoutDiv = document.createElement('div');
        layoutDiv.className = 'editor-layout';
        layoutDiv.style.cssText = 'height: 100%; min-height: 500px; width: 100%; display: flex; flex-direction: column;';

        const treeContainer = document.createElement('div');
        treeContainer.id = treeContainerId;
        treeContainer.className = 'syntree-canvas';
        treeContainer.style.cssText = 'flex-grow: 1; min-height: 500px; border: 1px solid #ddd; background: #21252b; overflow: hidden; position: relative;';

        // --- INJECT TOOLBAR (Teacher OR Student with allowImport) ---
        const toolbarDiv = document.createElement('div');
        const showImportToolbar = (_mode === 'teacher' || allowImport) && !isReadOnly;

        if (showImportToolbar) {
            toolbarDiv.style.cssText = 'padding: 10px; background: #eaecf0; border: 1px solid #ddd; border-bottom: none; display: flex; gap: 10px; align-items: center; justify-content: space-between; font-family: sans-serif;';
            const toolbarHtml = `
                <div style="display: flex; gap: 10px; align-items: center; width: 100%;">
                    <div style="position: relative; flex-grow: 1; display: flex; align-items: center;">
                        <input type="text" id="syntree-manual-bracket-${containerId}" placeholder="${escapeHtml(t('ui_import_bracket_placeholder'))}" style="width: 100%; padding: 6px 60px 6px 6px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; color: #000; background-color: #fff; box-sizing: border-box;">
                        <div style="position: absolute; right: 4px; display: flex; gap: 4px;">
                            <button type="button" id="btnCopyBracket-${containerId}" title="${escapeHtml(t('ui_copy_title'))}" style="padding: 2px 6px; background: #e0e0e0; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; font-size: 12px; color: #333;">${escapeHtml(t('ui_copy'))}</button>
                            <button type="button" id="btnClearBracket-${containerId}" title="${escapeHtml(t('ui_clear_input_title'))}" style="padding: 2px 6px; background: #e0e0e0; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; font-size: 12px; color: #333;">X</button>
                        </div>
                    </div>
                    <button type="button" id="btnImportBracket-${containerId}" style="padding: 6px 12px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-weight: 500;">${escapeHtml(t('ui_import_bracket'))}</button>
                    ${_mode === 'teacher' ? `
                    <button type="button" id="btnExportBracket-${containerId}" style="padding: 6px 12px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-weight: 500;">${escapeHtml(t('ui_export_bracket'))}</button>
                    <button type="button" id="btnClearTree-${containerId}" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">${escapeHtml(t('ui_clear_screen'))}</button>
                    ` : ''}
                    <button type="button" id="btnHelpTree-${containerId}" style="padding: 6px 12px; background: #607D8B; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">${escapeHtml(t('ui_help'))}</button>
                </div>
            `;
            toolbarDiv.innerHTML = toolbarHtml;
            layoutDiv.appendChild(toolbarDiv);
        }

        layoutDiv.appendChild(treeContainer);

        // Bottom toolbar div removed and only the Help button was moved to the top. Summary shared.

        // --- ADD UI TOGGLE BUTTON (Standalone style) ---
        const btnToggleUI = document.createElement('button');
        btnToggleUI.className = 'header-toggle';
        btnToggleUI.innerHTML = '▲';
        btnToggleUI.title = t('ui_toggle_toolbars');
        btnToggleUI.style.cssText = 'position: absolute; top: 10px; right: 10px; z-index: 21; width: 28px; height: 28px; background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.3s;';
        // There is nothing to toggle without the toolbar
        if (showImportToolbar) treeContainer.appendChild(btnToggleUI);

        const toggleToolbars = (forceHide?: boolean) => {
            const isCurrentlyHidden = toolbarDiv.style.display === 'none';
            const shouldHide = forceHide !== undefined ? forceHide : !isCurrentlyHidden;
            
            if (shouldHide) {
                if (toolbarDiv) toolbarDiv.style.display = 'none';
                btnToggleUI.style.transform = 'rotate(180deg)';
                btnToggleUI.style.top = '10px'; // Keep it accessible inside container
            } else {
                if (toolbarDiv) toolbarDiv.style.display = 'flex';
                btnToggleUI.style.transform = 'rotate(0deg)';
            }
        };

        btnToggleUI.onclick = (e) => {
            e.stopPropagation();
            toggleToolbars();
        };

        // Auto-collapse if screen is small
        if (window.innerHeight < 450) {
            toggleToolbars(true);
        }

        // --- INJECT MODALS DYNAMICALLY INTO THE MOODLE DOM ---
        const modalStyles = `
            .syntree-modal { position: fixed; z-index: 10000; left: 0; top: 0; width: 100vw; height: 100vh; overflow: auto; background-color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; }
            .syntree-modal.hidden { display: none; }
            .syntree-modal-content { background-color: #1e1e1e; padding: 30px; border-radius: 12px; width: 90%; max-width: 420px; text-align: center; box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4); color: #fff; display: flex; flex-direction: column; gap: 20px; }
            .syntree-modal-content h2 { margin: 0; font-size: 1.4rem; font-weight: 800; color: #fff; }
            .syntree-modal-content p { margin: 0; color: #abb2bf; font-size: 1.05rem; }
            .syntree-modal-buttons { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
            .syntree-btn { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s; color: white; }
            .syntree-btn:hover { transform: translateY(-1px); }
            .syntree-btn-green { background-color: #2ecc71; }
            .syntree-btn-green:hover { background-color: #27ae60; }
            .syntree-btn-orange { background-color: #f39c12; }
            .syntree-btn-orange:hover { background-color: #e67e22; }
            .syntree-btn-blue { background-color: #3498db; }
            .syntree-btn-blue:hover { background-color: #2980b9; }
            .syntree-btn-red { background-color: #e74c3c; margin-top: 5px; }
            .syntree-btn-red:hover { background-color: #c0392b; }

            /* FAB Styles */
            .fab-group {
                position: absolute;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 2000;
                pointer-events: none;
            }
            .fab-button {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background-color: rgba(52, 73, 94, 0.9);
                color: white;
                border: 1px solid rgba(255,255,255,0.2);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-size: 18px;
                font-weight: 800;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                user-select: none;
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                pointer-events: auto;
                padding: 0;
                line-height: 1;
            }
            .fab-button:hover { background-color: #2c3e50; transform: scale(1.1); }
            .fab-button svg { width: 24px; height: 24px; display: block; }

            @media (max-height: 500px) {
                .fab-group {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    bottom: 12px;
                    right: 12px;
                    gap: 8px;
                }
                .fab-button { width: 38px; height: 38px; font-size: 16px; }
                .fab-button svg { width: 20px; height: 20px; }
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.innerHTML = modalStyles;
        document.head.appendChild(styleEl);

        const modalsHtml = `
            <div id="moodleDndModal-${containerId}" class="syntree-modal hidden">
                <div class="syntree-modal-content">
                    <h2>${escapeHtml(t('ui_modal_dnd_title'))}</h2>
                    <p>${escapeHtml(t('ui_modal_dnd_question', { source: '\u0001', target: '\u0002' }))
                        .replace('\u0001', () => `<strong id="dragSourceLabel-${containerId}"></strong>`)
                        .replace('\u0002', () => `<strong id="dragTargetLabel-${containerId}"></strong>`)}</p>
                    <div class="syntree-modal-buttons">
                        <button type="button" id="btnDropOpChild1-${containerId}" class="syntree-btn syntree-btn-green">${escapeHtml(t('ui_dnd_child1_default'))}</button>
                        <button type="button" id="btnDropOpChild2-${containerId}" class="syntree-btn syntree-btn-orange">${escapeHtml(t('ui_dnd_child2_default'))}</button>
                        <button type="button" id="btnDropOpSwap-${containerId}" class="syntree-btn syntree-btn-blue">${escapeHtml(t('ui_dnd_swap'))}</button>
                        <button type="button" id="btnDropOpCancel-${containerId}" class="syntree-btn syntree-btn-red">${escapeHtml(t('ui_cancel'))}</button>
                    </div>
                </div>
            </div>
            <div id="moodleDeleteModal-${containerId}" class="syntree-modal hidden">
                <div class="syntree-modal-content">
                    <h2 style="margin-top:0;">${escapeHtml(t('ui_modal_delete_title'))}</h2>
                    <p>${escapeHtml(t('ui_modal_delete_question', '\u0001'))
                        .replace('\u0001', () => `<span id="deleteNodeLabel-${containerId}" style="font-weight:bold;"></span>`)}</p>
                    <div class="syntree-modal-buttons">
                        <button type="button" id="btnDeleteKeep-${containerId}" class="syntree-btn syntree-btn-green">${escapeHtml(t('ui_delete_keep'))}</button>
                        <button type="button" id="btnDeleteCascade-${containerId}" class="syntree-btn syntree-btn-red">${escapeHtml(t('ui_delete_cascade'))}</button>
                        <button type="button" id="btnDeleteCancel-${containerId}" class="syntree-btn syntree-btn-blue">${escapeHtml(t('ui_cancel'))}</button>
                    </div>
                </div>
            </div>
            <div id="moodleGuideModal-${containerId}" class="syntree-modal hidden" style="align-items:stretch; padding:0; z-index: 2000;">
                <div class="syntree-modal-content" style="max-width:900px; width:96vw; height:88vh; padding:0; overflow:hidden; position:relative; display:flex; flex-direction:column; border-radius:8px; background: #1a1d23;">
                    <div style="padding: 12px 20px; background: #21252b; border-bottom: 1px solid #3a3f4b; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; color: #fff; font-size: 1.2rem;">${escapeHtml(t('ui_modal_help_title'))}</h2>
                        <button type="button" id="btnCloseGuide-${containerId}" style="background:none; border:none; color:#abb2bf; font-size:24px; cursor:pointer;" title="${escapeHtml(t('ui_close'))}">✕</button>
                    </div>
                    <div id="guideContent-${containerId}" style="flex: 1; overflow-y: auto; padding: 0;" class="guide-scroll-container">
                        <div style="padding: 30px; color: #fff; text-align: center;">${escapeHtml(t('ui_loading_instructions'))}</div>
                    </div>
                </div>
            </div>
        `;

        const modalsContainer = document.createElement('div');
        modalsContainer.innerHTML = modalsHtml;
        layoutDiv.appendChild(modalsContainer);

        // --- PREPARE HELP INJECTION ---
        const guideContentDiv = modalsContainer.querySelector(`[id="guideContent-${containerId}"]`) as HTMLElement;
        const loadGuide = async () => {
            if (!guideContentDiv || guideContentDiv.dataset.loaded === 'true') return;
            // The guides sit next to the bundle. Deriving the folder from its URL also works when Moodle lives in a subdirectory.
            const bundleUrl: string = getParam('bundleUrl', 'bundleurl') || '';
            const baseUrl = bundleUrl ? bundleUrl.split('?')[0].replace(/[^/]*$/, '') : '/question/type/syntree/vue_app/dist/';
            const cacheBuster = `?v=${Date.now()}`;
            const guideUrl = `${baseUrl}guide-moodle-${_mode === 'teacher' ? 'teacher' : 'student'}.html${cacheBuster}`;
            const styleUrl = `${baseUrl}guide-style.css${cacheBuster}`;
            
            try {
                const [cssRes, htmlRes] = await Promise.all([fetch(styleUrl), fetch(guideUrl)]);
                if (!cssRes.ok || !htmlRes.ok) throw new Error("Failed to load guide assets.");
                const cssText = await cssRes.text();
                const htmlText = await htmlRes.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const styleTag = document.createElement('style');
                styleTag.textContent = cssText;
                guideContentDiv.innerHTML = `<div class="syntree-guide-view">${doc.body.innerHTML}</div>`;
                guideContentDiv.prepend(styleTag);
                guideContentDiv.dataset.loaded = 'true';
            } catch (err) {
                console.error("Guide load failed:", err);
                guideContentDiv.innerHTML = `<div style="padding: 20px; color: #e06c75;">${escapeHtml(t('ui_guide_load_error'))}</div>`;
            }
        };

        // Clear whatever Moodle put in the container (like the "Loading..." text)
        container.innerHTML = '';
        container.appendChild(layoutDiv);

        // --- BIND UI AFTER APPEND ---
        const btnHelpTree = document.getElementById(`btnHelpTree-${containerId}`);
        const moodleGuideModal = document.getElementById(`moodleGuideModal-${containerId}`) as HTMLElement;
        const btnCloseGuide = document.getElementById(`btnCloseGuide-${containerId}`);

        if (btnHelpTree && moodleGuideModal) {
            // Register this instance in the global help registry
            helpRegistry[containerId] = {
                modal: moodleGuideModal,
                load: loadGuide
            };

            btnHelpTree.onclick = (e) => {
                e.preventDefault();
                moodleGuideModal.classList.remove('hidden');
                loadGuide();
            };
            if (btnCloseGuide) {
                btnCloseGuide.onclick = () => moodleGuideModal.classList.add('hidden');
            }
            moodleGuideModal.onclick = (e) => {
                if (e.target === moodleGuideModal) moodleGuideModal.classList.add('hidden');
            };
        }

        // Create a warning message element for disconnected nodes
        const warningDiv = document.createElement('div');
        warningDiv.id = `syntree-warning-${containerId}`;
        warningDiv.style.cssText = 'display: none; padding: 12px; background: #fff3cd; color: #856404; border: 2px solid #ffeeba; border-bottom: none; font-family: sans-serif; font-weight: bold; text-align: center; font-size: 16px;';
        warningDiv.textContent = t('ui_disconnected_warning');
        layoutDiv.insertBefore(warningDiv, treeContainer);


        // Pass the element directly to avoid getElementById lookup issues
        const renderer = new TreeRenderer(treeContainer);
        renderer.allowTraces = allowTraces; // Set the allowTraces flag
        renderer.isReadOnly = isReadOnly;
        const manager = new TreeManager();

        // Auto-save logic whenever the tree changes
        const saveToHiddenInput = () => {
            try {
                const bracket = manager.exportToBracketNotation();
                hiddenInput.value = bracket;
            } catch (e) {
                console.error("Failed to export tree to bracket for Moodle answer", e);
            }
        };

        function renderCurrentTree() {
            const tree = manager.getTree();
            renderer.render(tree);
            saveToHiddenInput();

            // Check for disconnected nodes (multiple roots)
            const roots = Object.keys(tree.nodes).filter(k => !tree.nodes[k].parentId);

            if (roots.length > 1 && !isReadOnly) {
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }
        }

        // Build the initial tree
        if (_initialData.startsWith('[')) {
            // It's a bracket notation (e.g. teacher editing an existing question)
            const success = manager.importFromBracketNotation(_initialData);
            if (!success) {
                console.error("Invalid bracket notation provided.");
            }
            manager.clearHistory(); // Prevent undoing to absolute blank state on load
            renderCurrentTree();
            renderer.centerView();
            requestAnimationFrame(() => renderer.centerView());
            setTimeout(() => renderer.centerView(), 500);
        } else if (_initialData !== "") {
            // It's just words - we need to parse them as tokens to start a new tree
            let initialTokens: string[] = [];
            if (_initialData.includes('|')) {
                initialTokens = _initialData.split('|').map((t: string) => t.trim()).filter((t: string) => t !== '');
            } else {
                initialTokens = _initialData.split(/\s+/);
            }
            manager.setTokens(initialTokens);
            manager.rebuildLeafSequence();
            manager.clearHistory();
            renderCurrentTree();
            renderer.centerView();
            requestAnimationFrame(() => renderer.centerView());
            setTimeout(() => renderer.centerView(), 500);
        } else {
            // Empty tree (e.g. fresh teacher view)
            manager.setTokens([]);
            const rootId = manager.addNode("");
            manager.getTree().rootId = rootId;
            manager.rebuildLeafSequence();
            manager.clearHistory();
            renderCurrentTree();
            renderer.centerView();
            requestAnimationFrame(() => renderer.centerView());
            setTimeout(() => renderer.centerView(), 500);
        }


        // Help buttons are now bound during modal creation for fetch logic. Summary shared.

        // Renderer callbacks for Undo/Redo
        renderer.onUndo = () => { if (manager.undo()) renderCurrentTree(); };
        renderer.onRedo = () => { if (manager.redo()) renderCurrentTree(); };

        // Keyboard shortcuts, same as the web version. They go to the editor that was clicked last. They are heard on the
        // document, not the canvas: a click re-renders the canvas, the clicked element disappears and the browser drops the focus.
        layoutDiv.addEventListener('pointerdown', () => { activeShortcutEditor = containerId; }, true);
        document.addEventListener('pointerdown', (e) => {
            if (activeShortcutEditor === containerId && e.target instanceof Node && !layoutDiv.contains(e.target)) {
                activeShortcutEditor = null;
            }
        }, true);
        document.addEventListener('keydown', (e) => {
            if (activeShortcutEditor !== containerId || !(e.ctrlKey || e.metaKey)) return;
            const t = e.target;
            if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement ||
                (t instanceof HTMLElement && t.isContentEditable)) return;

            // e.code is the physical key, so the shortcuts also work with a Cyrillic keyboard layout
            const code = e.code;
            if (code === 'KeyZ' && !isReadOnly) {
                e.preventDefault();
                if (e.shiftKey) renderer.onRedo!(); else renderer.onUndo!();
            } else if (code === 'KeyY' && !isReadOnly) {
                e.preventDefault();
                renderer.onRedo!();
            } else if (code === 'Equal' || code === 'NumpadAdd' || e.key === '+') {
                e.preventDefault();
                renderer.zoomIn();
            } else if (code === 'Minus' || code === 'NumpadSubtract') {
                e.preventDefault();
                renderer.zoomOut();
            } else if (code === 'Digit0' || code === 'Numpad0') {
                e.preventDefault();
                renderer.resetZoom();
            }
        });

        // --- BIND TOOLBAR BUTTONS (All Modes showing toolbar) ---
        const manualBracketInput = document.getElementById(`syntree-manual-bracket-${containerId}`) as HTMLInputElement;
        const btnImportBracket = document.getElementById(`btnImportBracket-${containerId}`) as HTMLButtonElement;
        const btnExportBracket = document.getElementById(`btnExportBracket-${containerId}`) as HTMLButtonElement;
        const btnClearTree = document.getElementById(`btnClearTree-${containerId}`) as HTMLButtonElement;
        const btnCopyBracket = document.getElementById(`btnCopyBracket-${containerId}`) as HTMLButtonElement;
        const btnClearBracket = document.getElementById(`btnClearBracket-${containerId}`) as HTMLButtonElement;

        if (btnClearBracket && manualBracketInput) {
            btnClearBracket.addEventListener('click', () => {
                manualBracketInput.value = '';
                manualBracketInput.focus();
            });
        }

        if (btnCopyBracket && manualBracketInput) {
            btnCopyBracket.addEventListener('click', () => {
                manualBracketInput.select();
                document.execCommand('copy');
                const originalText = btnCopyBracket.textContent;
                btnCopyBracket.textContent = t('ui_copied');
                setTimeout(() => { btnCopyBracket.textContent = originalText; }, 1500);
            });
        }

        if (btnImportBracket && manualBracketInput) {
            btnImportBracket.addEventListener('click', () => {
                const text = manualBracketInput.value.trim();
                if (!text) return;
                const success = manager.importFromBracketNotation(text);
                if (success) {
                    manager.clearHistory();
                    renderCurrentTree();
                    renderer.centerView();
                } else {
                    alert(t('ui_invalid_bracket'));
                }
            });
        }

        if (_mode === 'teacher') {
            const allowTracesCheckbox = document.getElementById('id_allowtraces') as HTMLInputElement;
            if (allowTracesCheckbox) {
                allowTracesCheckbox.addEventListener('change', (e) => {
                    const target = e.target as HTMLInputElement;
                    renderer.allowTraces = target.checked;
                    renderCurrentTree();
                });
            }

            if (btnExportBracket && manualBracketInput) {
                btnExportBracket.addEventListener('click', () => {
                    manualBracketInput.value = manager.exportToBracketNotation();
                });
            }

            if (btnClearTree && manualBracketInput) {
                btnClearTree.addEventListener('click', () => {
                    manager.setTokens([]);
                    const rootId = manager.addNode("");
                    manager.getTree().rootId = rootId;
                    manager.rebuildLeafSequence();
                    manager.clearHistory();
                    manualBracketInput.value = '';
                    renderCurrentTree();
                    renderer.centerView();
                });
            }
        }

        // Connect standard interactivity UI events from renderer to manager
        // Background click to deselect
        renderer.onBackgroundClick = () => {
            renderer.selectedId = null;
            renderCurrentTree();
        };

        renderer.onElementClick = (id: string, _isToken: boolean) => {
            renderer.selectedId = id;
            renderCurrentTree();
        };

        renderer.onLabelChange = (id: string, newLabel: string, newLexicalItem?: string) => {
            const node = manager.getTree().nodes[id];
            if (node) {
                node.label = newLabel;
                if (newLexicalItem !== undefined) {
                    node.lexicalItem = newLexicalItem;
                }
                manager.saveState();
                renderCurrentTree();
            }
        };

        renderer.onAddParentClick = (childId: string) => {
            manager.addParent(childId, "");
            renderCurrentTree();
        };

        renderer.onAddChildClick = (parentId: string) => {
            const node = manager.getTree().nodes[parentId];
            if (!node) return;

            const childId = manager.addNode("", []);
            node.childrenIds.push(childId);
            manager.getTree().nodes[childId].parentId = parentId;

            manager.rebuildLeafSequence();
            manager.saveState();
            renderCurrentTree();
        };

        // --- TRACE EVENTS ---
        renderer.onTraceCreate = (sourceId: string, targetId: string) => {
            const tree = manager.getTree();
            const sourceNode = tree.nodes[sourceId];
            const targetNode = tree.nodes[targetId];

            if (sourceNode && targetNode) {
                if (!sourceNode.tracesTo) sourceNode.tracesTo = [];
                if (!sourceNode.tracesTo.find((t: any) => t.targetId === targetId)) {
                    sourceNode.tracesTo.push({ targetId, style: 'curved' });
                    manager.saveState();
                    renderCurrentTree();
                }
            }
        };

        renderer.onTraceDelete = (sourceId: string, targetId: string) => {
            const tree = manager.getTree();
            const sourceNode = tree.nodes[sourceId];

            if (sourceNode && sourceNode.tracesTo) {
                sourceNode.tracesTo = sourceNode.tracesTo.filter((t: any) => t.targetId !== targetId);
                if (sourceNode.tracesTo.length === 0) {
                    delete sourceNode.tracesTo;
                }
                manager.saveState();
                renderCurrentTree();
            }
        };

        renderer.onTraceStyleToggle = (sourceId: string, targetId: string) => {
            const tree = manager.getTree();
            const sourceNode = tree.nodes[sourceId];

            if (sourceNode && sourceNode.tracesTo) {
                const trace = sourceNode.tracesTo.find((t: any) => t.targetId === targetId);
                if (trace) {
                    trace.style = trace.style === 'curved' ? 'orthogonal' : 'curved';
                    manager.saveState();
                    renderCurrentTree();
                }
            }
        };

        renderer.onTraceDashToggle = (sourceId: string, targetId: string) => {
            const tree = manager.getTree();
            const sourceNode = tree.nodes[sourceId];

            if (sourceNode && sourceNode.tracesTo) {
                const trace = sourceNode.tracesTo.find((t: any) => t.targetId === targetId);
                if (trace) {
                    trace.dashed = trace.dashed === false ? true : false;
                    manager.saveState();
                    renderCurrentTree();
                }
            }
        };

        // --- MODAL LOGIC & DELETE ---

        let pendingDeleteNodeId: string | null = null;
        const deleteModal = document.getElementById(`moodleDeleteModal-${containerId}`) as HTMLDivElement;
        const btnDeleteKeep = document.getElementById(`btnDeleteKeep-${containerId}`) as HTMLButtonElement;
        const btnDeleteCascade = document.getElementById(`btnDeleteCascade-${containerId}`) as HTMLButtonElement;
        const btnDeleteCancel = document.getElementById(`btnDeleteCancel-${containerId}`) as HTMLButtonElement;
        const deleteNodeLabel = document.getElementById(`deleteNodeLabel-${containerId}`) as HTMLSpanElement;

        const closeDeleteModal = () => {
            deleteModal.classList.add('hidden');
            pendingDeleteNodeId = null;
        };

        btnDeleteCancel.addEventListener('click', closeDeleteModal);

        btnDeleteKeep.addEventListener('click', () => {
            if (!pendingDeleteNodeId) return;
            const tree = manager.getTree();
            const node = tree.nodes[pendingDeleteNodeId];
            if (!node) { closeDeleteModal(); return; }

            // Unlink & reconnect children to parent
            if (node.parentId && tree.nodes[node.parentId]) {
                const p = tree.nodes[node.parentId];
                const idx = p.childrenIds.indexOf(node.id);
                if (idx !== -1) {
                    p.childrenIds.splice(idx, 1, ...node.childrenIds);
                }
                node.childrenIds.forEach((cId: string) => {
                    if (tree.nodes[cId]) tree.nodes[cId].parentId = node.parentId;
                });
            } else {
                // No parent (root node)
                node.childrenIds.forEach((cId: string) => {
                    if (tree.nodes[cId]) tree.nodes[cId].parentId = null;
                });
                if (tree.rootId === node.id) tree.rootId = null;
            }
            delete tree.nodes[node.id];

            manager.rebuildLeafSequence();
            manager.saveState();
            renderer.selectedId = null;
            renderCurrentTree();
            closeDeleteModal();
        });

        btnDeleteCascade.addEventListener('click', () => {
            if (!pendingDeleteNodeId) return;
            manager.deleteNode(pendingDeleteNodeId);
            renderer.selectedId = null;
            renderCurrentTree();
            closeDeleteModal();
        });

        renderer.onDeleteClick = (id: string) => {
            const tree = manager.getTree();
            const node = tree.nodes[id];
            if (!node) return;

            if (node.childrenIds.length > 0) {
                // Show modal if it has children
                pendingDeleteNodeId = id;
                deleteNodeLabel.textContent = node.label || '?';
                deleteModal.classList.remove('hidden');
                return;
            }

            // Normal delete if no children
            manager.deleteNode(id);
            renderer.selectedId = null;
            renderCurrentTree();
        };

        // --- DND LOGIC ---
        let pendingDropSourceId: string | null = null;
        let pendingDropTargetId: string | null = null;
        let pendingDropSide: 'left' | 'right' = 'right';

        const dndModal = document.getElementById(`moodleDndModal-${containerId}`) as HTMLDivElement;
        const btnDropOpChild1 = document.getElementById(`btnDropOpChild1-${containerId}`) as HTMLButtonElement;
        const btnDropOpChild2 = document.getElementById(`btnDropOpChild2-${containerId}`) as HTMLButtonElement;
        const btnDropOpSwap = document.getElementById(`btnDropOpSwap-${containerId}`) as HTMLButtonElement;
        const btnDropOpCancel = document.getElementById(`btnDropOpCancel-${containerId}`) as HTMLButtonElement;

        const closeDndModal = () => {
            dndModal.classList.add('hidden');
            pendingDropSourceId = null;
            pendingDropTargetId = null;
        };

        btnDropOpCancel.addEventListener('click', closeDndModal);

        btnDropOpChild1.addEventListener('click', () => {
            if (pendingDropSourceId && pendingDropTargetId) {
                manager.makeChild(pendingDropTargetId, pendingDropSourceId, pendingDropSide);
                renderCurrentTree();
            }
            closeDndModal();
        });

        btnDropOpChild2.addEventListener('click', () => {
            if (pendingDropSourceId && pendingDropTargetId) {
                manager.makeChild(pendingDropSourceId, pendingDropTargetId);
                renderCurrentTree();
            }
            closeDndModal();
        });

        btnDropOpSwap.addEventListener('click', () => {
            if (pendingDropSourceId && pendingDropTargetId) {
                manager.swapNodes(pendingDropSourceId, pendingDropTargetId);
                renderCurrentTree();
            }
            closeDndModal();
        });

        renderer.onNodeDrop = (sourceId: string, targetId: string, side: 'left' | 'right') => {
            const tree = manager.getTree();
            const sourceNode = tree.nodes[sourceId];
            const targetNode = tree.nodes[targetId];

            if (!sourceNode || !targetNode) return;

            pendingDropSourceId = sourceId;
            pendingDropTargetId = targetId;
            pendingDropSide = side;

            const sLabel = sourceNode.label || '?';
            const tLabel = targetNode.label || '?';

            // Set labels in descriptions
            const srcEl = document.getElementById(`dragSourceLabel-${containerId}`);
            const tgtEl = document.getElementById(`dragTargetLabel-${containerId}`);
            if (srcEl) srcEl.textContent = sLabel;
            if (tgtEl) tgtEl.textContent = tLabel;

            btnDropOpChild1.textContent = t('ui_dnd_child1', { source: sLabel, target: tLabel });
            btnDropOpChild2.textContent = t('ui_dnd_child2', { source: sLabel, target: tLabel });

            dndModal.classList.remove('hidden');
        };

        // Do an initial save just in case
        saveToHiddenInput();


        return renderer;

    } catch (err) {
        console.error("FATAL ERROR in initSyntaxTreeEditor:", err);
    }
};

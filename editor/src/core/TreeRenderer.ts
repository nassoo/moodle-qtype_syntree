/**
 * Syntax Tree Editor: SVG rendering and pointer interaction.
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
import { SyntaxTree, ElementId } from './types';
import { AppSettings, DEFAULT_SETTINGS } from './Settings';
import { t } from './i18n';

export function parseFormattedText(input: string): { text: string, type: 'normal' | 'sub' | 'sup' | 'strike' }[] {
    const segments: { text: string, type: 'normal' | 'sub' | 'sup' | 'strike' }[] = [];
    let currentText = "";
    let i = 0;

    while (i < input.length) {
        if (input[i] === '\\' && (input[i+1] === '_' || input[i+1] === '^' || input[i+1] === '~')) {
            currentText += input[i+1];
            i += 2;
            continue;
        }

        if (input[i] === '~' && input[i+1] === '~') {
            if (currentText) {
                segments.push({ text: currentText, type: 'normal' });
                currentText = "";
            }
            i += 2;
            let content = "";
            let closed = false;
            while (i < input.length) {
                if (input[i] === '~' && input[i+1] === '~') {
                    closed = true;
                    i += 2;
                    break;
                }
                content += input[i];
                i++;
            }
            if (closed) {
                segments.push({ text: content, type: 'strike' });
            } else {
                segments.push({ text: '~~' + content, type: 'normal' });
            }
            continue;
        }

        if (input[i] === '_' || input[i] === '^') {
            const type = input[i] === '_' ? 'sub' : 'sup';
            
            if (currentText) {
                segments.push({ text: currentText, type: 'normal' });
                currentText = "";
            }

            i++;
            if (i >= input.length) {
                segments.push({ text: type === 'sub' ? '_' : '^', type: 'normal' });
                break;
            }

            if (input[i] === '{') {
                i++;
                let content = "";
                let closed = false;
                while (i < input.length) {
                    if (input[i] === '}') {
                        closed = true;
                        i++;
                        break;
                    }
                    content += input[i];
                    i++;
                }
                if (closed) {
                    segments.push({ text: content, type });
                } else {
                    segments.push({ text: (type === 'sub' ? '_{' : '^{') + content, type: 'normal' });
                }
            } else {
                segments.push({ text: input[i], type });
                i++;
            }
        } else {
            currentText += input[i];
            i++;
        }
    }

    if (currentText) {
        segments.push({ text: currentText, type: 'normal' });
    }

    return segments;
}

export function getVisualLength(input: string): number {
    const segments = parseFormattedText(input);
    let len = 0;
    for (const seg of segments) {
        if (seg.type === 'normal' || seg.type === 'strike') len += seg.text.length;
        else len += seg.text.length * 0.75;
    }
    return len;
}

export function renderFormattedTextToSVG(
    textEl: SVGTextElement, 
    text: string, 
    parentFontSize: number, 
    ns: string = "http://www.w3.org/2000/svg"
) {
    const segments = parseFormattedText(text);
    textEl.textContent = ''; 

    let currentOffset = 0;
    
    segments.forEach(seg => {
        const tspan = document.createElementNS(ns, "tspan");
        tspan.textContent = seg.text;
        
        let targetOffset = 0;
        if (seg.type === 'sub') targetOffset = parentFontSize * 0.3;
        if (seg.type === 'sup') targetOffset = -parentFontSize * 0.4;
        
        const diff = targetOffset - currentOffset;
        if (diff !== 0) {
            tspan.setAttribute("dy", `${diff}px`);
        }
        
        if (seg.type === 'strike') {
            tspan.setAttribute("text-decoration", "line-through");
        } else if (seg.type !== 'normal') {
            tspan.setAttribute("font-size", "75%");
        }
        
        textEl.appendChild(tspan);
        currentOffset = targetOffset;
    });
}

// Configuration for visual appearance — kept in sync with AppSettings
export let LAYOUT_CONFIG = {
    nodeWidth: 40,
    nodeHeight: 30,
    levelHeight: DEFAULT_SETTINGS.levelHeight,
    tokenMargin: DEFAULT_SETTINGS.tokenMargin,
    rootMarginTop: DEFAULT_SETTINGS.rootMarginTop
};

export interface Position {
    x: number;
    y: number;
}

export class TreeRenderer {
    private container: HTMLElement;
    private treeInfo: SyntaxTree | null = null;

    // Store calculated positions
    private positions: Record<ElementId, Position> = {};
    private nodeWidths: Record<ElementId, number> = {};

    // UI State
    public selectedId: ElementId | null = null;
    public editingId: ElementId | null = null;
    public selectedTrace: { sourceId: string, targetId: string } | null = null;

    // Callbacks
    public onElementClick: ((id: ElementId, isToken: boolean) => void) | null = null;
    public onBackgroundClick: (() => void) | null = null;

    // Popup context action callbacks
    public onAddParentClick?: (id: string) => void;
    public onAddChildClick?: (id: string) => void;
    public onDeleteClick?: (id: string) => void;
    public onTraceCreate?: (sourceId: string, targetId: string) => void;
    public onTraceDelete?: (sourceId: string, targetId: string) => void;
    public onTraceStyleToggle?: (sourceId: string, targetId: string) => void;
    public onTraceDashToggle?: (sourceId: string, targetId: string) => void;
    public onToggleTriangleClick?: (id: string) => void;
    public onUndo?: () => void;
    public onRedo?: () => void;

    // Feature flags
    public allowTraces: boolean = true;
    public allowTriangles: boolean = false;

    // User-configurable settings
    private _settings: AppSettings = { ...DEFAULT_SETTINGS };

    public get settings(): AppSettings { return this._settings; }
    public set settings(val: AppSettings) {
        this._settings = val;
        // Keep LAYOUT_CONFIG in sync
        LAYOUT_CONFIG.levelHeight = val.levelHeight;
        LAYOUT_CONFIG.tokenMargin = val.tokenMargin;
        LAYOUT_CONFIG.rootMarginTop = val.rootMarginTop;
    }
    public isReadOnly: boolean = false;

    // Drag and Drop State
    private isDragging = false;
    private draggedNodeId: ElementId | null = null;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private hasMoved = false;

    // Auto Pan State
    private autoPanRafId: number | null = null;
    private pointerClientX: number = 0;
    private pointerClientY: number = 0;
    private pointerPageX: number = 0;
    private pointerPageY: number = 0;

    // Trace Creation State
    public isDrawingTraceOriginId: ElementId | null = null;
    private tracePreviewPath: SVGPathElement | null = null;

    // Panning and Zooming State
    private isPanning = false;
    private panStartX = 0;
    private panStartY = 0;
    private startPanX = 0; // Where panX was when dragging started
    private startPanY = 0; // Where panY was when dragging started
    private panX = 0; // Current global pan offset
    private panY = 0; // Current global pan offset
    private zoom = 1.0; // Current zoom level
    private minZoom = 0.1;
    private maxZoom = 5.0;

    // Double click tracking
    private lastClickTime: number = 0;
    private lastClickedId: ElementId | null = null;

    // Unique marker id so several editors on one page don't share one arrowhead definition
    private static instanceCount = 0;
    private readonly markerId: string = `syntree-arrowhead-${++TreeRenderer.instanceCount}`;

    // Long press tracking
    private longPressTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly longPressDelay: number = 500;
    private readonly dragThreshold: number = 10; // px of movement before a press becomes a drag

    // Multi-touch tracking
    private activePointers: Map<number, { clientX: number, clientY: number, pageX: number, pageY: number }> = new Map();
    private lastPinchDistance: number | null = null;


    // Drop callback: sourceId dropped onto targetId, with preferred side ('left' | 'right')
    public onNodeDrop: ((sourceId: ElementId, targetId: ElementId, side: 'left' | 'right') => void) | null = null;

    // Updated definition to handle both label and lexicalItem
    public onLabelChange: ((nodeId: ElementId, newLabel: string, newLexicalItem?: string) => void) | null = null;

    private boundPointerMove: (e: PointerEvent) => void;
    private boundPointerUp: (e: PointerEvent) => void;

    constructor(containerOrId: string | HTMLElement) {
        let el = null;
        if (typeof containerOrId === 'string') {
            el = document.getElementById(containerOrId);
        } else {
            el = containerOrId;
        }

        if (!el) throw new Error(`Container not found`);
        this.container = el;

        // Ensure the container is positioned so absolute floating UI elements stay inside it,
        // and prevent scrollbars if elements slightly overlap the edge
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';

        // Prevent native text selection and touch highlights which cause visual artifacts (blue teardrops) during panning
        this.container.style.userSelect = 'none';
        (this.container.style as any).webkitUserSelect = 'none';
        (this.container.style as any).webkitTouchCallout = 'none';
        (this.container.style as any).webkitTapHighlightColor = 'transparent';

        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
    }

    public render(tree: SyntaxTree) {
        this.treeInfo = tree;
        this.positions = {};

        // 1. Calculate positions
        this.calculateLayout();

        // 2. Clear HTML and draw SVG
        this.container.innerHTML = '';
        this.drawSVG();

        // 3. Update cursor if waiting for trace target
        if (this.isDrawingTraceOriginId) {
            this.container.style.cursor = 'crosshair';
        } else {
            this.container.style.cursor = 'default';
        }
    }

    public centerView() {
        if (!this.treeInfo || Object.keys(this.positions).length === 0) return;

        const cw = this.container.clientWidth;
        const ch = this.container.clientHeight;

        if (!cw || cw <= 0) {
            // Container not yet laid out — defer centering
            this.centerViewDeferred();
            return;
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        Object.values(this.positions).forEach(pos => {
            if (pos.x < minX) minX = pos.x;
            if (pos.x > maxX) maxX = pos.x;
            if (pos.y < minY) minY = pos.y;
            if (pos.y > maxY) maxY = pos.y;
        });

        // Center the tree bounding box in the target container
        // Math: screen_middle = (pan + minX*zoom + pan + maxX*zoom) / 2 
        // => pan = cw/2 - ((minX + maxX)/2) * zoom
        this.panX = (cw / 2) - ((minX + maxX) / 2) * this.zoom;
        
        if (ch > 0) {
            this.panY = (ch / 2) - ((minY + maxY) / 2) * this.zoom;
        } else {
            this.panY = 50 - ((minY + maxY) / 2) * this.zoom; // Fallback if height is 0
        }

        // Apply immediately
        const viewport = this.container.querySelector('#viewport');
        if (viewport) {
            viewport.setAttribute("transform", `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
        }
    }

    public zoomIn() {
        const rect = this.container.getBoundingClientRect();
        this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
    }
 
    public zoomOut() {
        const rect = this.container.getBoundingClientRect();
        this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
    }

    public resetZoom() {
        this.zoom = 1.0;
        this.centerView();
    }

    /**
     * Zooms the viewport focused on a specific screen coordinate.
     * Keeps the point under the cursor pinned during scaling.
     */
    public zoomAt(clientX: number, clientY: number, factor: number) {
        const oldZoom = this.zoom;
        const newZoom = Math.min(Math.max(oldZoom * factor, this.minZoom), this.maxZoom);
        
        if (oldZoom === newZoom) return;

        const rect = this.container.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        // Calculate point in SVG space before zooming
        const svgX = (offsetX - this.panX) / oldZoom;
        const svgY = (offsetY - this.panY) / oldZoom;

        this.zoom = newZoom;

        // Update pan to keep the point pinned under the cursor
        this.panX = offsetX - svgX * newZoom;
        this.panY = offsetY - svgY * newZoom;

        const viewport = this.container.querySelector('#viewport');
        if (viewport) {
            viewport.setAttribute("transform", `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
        }
    }

    /**
     * Waits for the container to get a real width, then centers the view.
     * Uses ResizeObserver with a fallback setTimeout.
     */
    private centerViewDeferred() {
        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0) {
                        ro.disconnect();
                        this.centerView();
                        return;
                    }
                }
            });
            ro.observe(this.container);
            // Safety fallback: disconnect after 3 seconds even if not triggered
            setTimeout(() => {
                ro.disconnect();
                this.centerView();
            }, 3000);
        } else {
            // Fallback for older browsers
            setTimeout(() => this.centerView(), 500);
        }
    }

    private calculateLayout() {
        if (!this.treeInfo || Object.keys(this.treeInfo.nodes).length === 0) return;

        this.nodeWidths = {};

        // 1. Calculate subtree bounding widths bottom-up
        const computeSubtreeWidth = (nodeId: string): number => {
            const node = this.treeInfo!.nodes[nodeId];
            if (!node) return 0;

            if (node.isTriangle) {
                const text = node.lexicalItem || "";
                const minWidth = Math.max(LAYOUT_CONFIG.nodeWidth, getVisualLength(text) * 8 + 30);
                this.nodeWidths[nodeId] = minWidth;
                return minWidth;
            }

            const textToMeasure = node.lexicalItem || node.label || "";
            const minWidth = Math.max(LAYOUT_CONFIG.nodeWidth, getVisualLength(textToMeasure) * 8 + 30); // 30 is padding

            if (node.childrenIds.length === 0) {
                this.nodeWidths[nodeId] = minWidth;
                return minWidth;
            }

            let childrenTotalWidth = 0;
            for (const childId of node.childrenIds) {
                childrenTotalWidth += computeSubtreeWidth(childId);
            }

            childrenTotalWidth += (node.childrenIds.length - 1) * LAYOUT_CONFIG.tokenMargin;
            const finalWidth = Math.max(minWidth, childrenTotalWidth);
            this.nodeWidths[nodeId] = finalWidth;
            return finalWidth;
        };

        // Find roots respecting leafSequence order loosely
        const rootsInOrder: string[] = [];
        const seenRoots = new Set<string>();
        for (const leafId of this.treeInfo.leafSequence) {
            let curr = leafId;
            while (this.treeInfo.nodes[curr] && this.treeInfo.nodes[curr].parentId) {
                curr = this.treeInfo.nodes[curr]!.parentId!;
            }
            if (!seenRoots.has(curr)) {
                seenRoots.add(curr);
                rootsInOrder.push(curr);
            }
        }

        Object.keys(this.treeInfo.nodes).forEach(id => {
            if (!this.treeInfo!.nodes[id].parentId && !seenRoots.has(id)) {
                rootsInOrder.push(id);
                seenRoots.add(id);
            }
        });

        for (const r of rootsInOrder) {
            computeSubtreeWidth(r);
        }

        // 2. Assign coordinates top-down
        let currentX = LAYOUT_CONFIG.nodeWidth / 2;

        const assignPositions = (nodeId: string, startX: number, depth: number) => {
            const node = this.treeInfo!.nodes[nodeId];
            if (!node) return;

            const myWidth = this.nodeWidths[nodeId] || 0;
            const isLeaf = node.childrenIds.length === 0;

            // Linguists draw leaves aligned at bottom usually, unless requested otherwise
            // but here leaves align at the true bottom and intermediate nodes align to discrete levels
            let myY = (depth * LAYOUT_CONFIG.levelHeight) + LAYOUT_CONFIG.rootMarginTop;

            this.positions[nodeId] = {
                x: startX + (myWidth / 2),
                y: myY
            };

            if (!isLeaf && !node.isTriangle) {
                let childrenTotalWidth = 0;
                node.childrenIds.forEach(cid => { childrenTotalWidth += this.nodeWidths[cid] || 0; });
                childrenTotalWidth += (node.childrenIds.length - 1) * LAYOUT_CONFIG.tokenMargin;

                let childStartX = startX + (myWidth - childrenTotalWidth) / 2;

                for (const childId of node.childrenIds) {
                    assignPositions(childId, childStartX, depth + 1);
                    childStartX += (this.nodeWidths[childId] || 0) + LAYOUT_CONFIG.tokenMargin;
                }
            }
        };

        for (const r of rootsInOrder) {
            assignPositions(r, currentX, 0);
            currentX += (this.nodeWidths[r] || 0) + LAYOUT_CONFIG.tokenMargin;
        }
    }



    private drawSVG() {
        try {
        if (!this.treeInfo) return;

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.overflow = "visible";
        svg.style.userSelect = "none";
        // Ensure SVG fully covers the relative container to catch all background clicks
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";

        const viewport = document.createElementNS(ns, "g");
        viewport.setAttribute("id", "viewport");
        viewport.setAttribute("transform", `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
        svg.appendChild(viewport);

        // Add arrowhead marker definition for traces
        const defs = document.createElementNS(ns, "defs");
        const marker = document.createElementNS(ns, "marker");
        marker.setAttribute("id", this.markerId);
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "7");
        marker.setAttribute("refX", "9");
        marker.setAttribute("refY", "3.5");
        marker.setAttribute("orient", "auto");

        const polygon = document.createElementNS(ns, "polygon");
        polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
        polygon.setAttribute("fill", "#8e44ad");
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);

        // Group for lines
        const linesGroup = document.createElementNS(ns, "g");
        viewport.appendChild(linesGroup);

        // Group for nodes
        const nodesGroup = document.createElementNS(ns, "g");
        viewport.appendChild(nodesGroup);

        // Group for interactive UI elements (popups)
        const uiGroup = document.createElementNS(ns, "g");
        uiGroup.setAttribute("id", "ui-group");
        uiGroup.style.pointerEvents = "none"; // Let clicks pass through empty areas
        viewport.appendChild(uiGroup);

        // Draw connections first so they are under the text nodes
        Object.values(this.treeInfo.nodes).forEach(node => {
            const parentPos = this.positions[node.id];
            if (!parentPos) return;

            if (node.childrenIds.length > 0 && !node.isTriangle) {
                node.childrenIds.forEach(childId => {
                    const childPos = this.positions[childId];
                    if (!childPos) return;

                    const line = document.createElementNS(ns, "line");
                    line.setAttribute("x1", parentPos.x.toString());
                    line.setAttribute("y1", (parentPos.y + 14).toString());
                    line.setAttribute("x2", childPos.x.toString());
                    line.setAttribute("y2", (childPos.y - 14).toString());
                    line.setAttribute("data-parent", node.id);
                    line.setAttribute("data-child", childId);
                    line.setAttribute("data-x1", parentPos.x.toString());
                    line.setAttribute("data-y1", (parentPos.y + 14).toString());
                    line.setAttribute("data-x2", childPos.x.toString());
                    line.setAttribute("data-y2", (childPos.y - 14).toString());
                    line.setAttribute("stroke", this._settings.lineColor);
                    line.setAttribute("stroke-width", "2");
                    linesGroup.appendChild(line);
                });
            }
        });

        // Array to keep track of drawn horizontal trace segments to avoid overlaps
        const horizontalSegments: { minX: number, maxX: number, y: number }[] = [];
        // Array to keep track of drawn vertical trace segments to avoid overlaps
        const verticalSegments: { x: number, minY: number, maxY: number }[] = [];

        // Draw Trace movements (dotted curves)
        Object.values(this.treeInfo.nodes).forEach(node => {
            if (node.tracesTo && node.tracesTo.length > 0) {
                node.tracesTo.forEach((traceObj: any) => {
                    try {
                        const targetId = typeof traceObj === 'string' ? traceObj : traceObj.targetId;
                        const traceStyle = typeof traceObj === 'string' ? 'curved' : (traceObj.style || 'curved');
                        const isDashed = typeof traceObj === 'string' ? true : (traceObj.dashed !== false);
                        
                        if (!this.positions[node.id] || !this.positions[targetId]) return;

                        const pStart = this.positions[node.id];
                        const pEnd = this.positions[targetId];

                        const targetNode = this.treeInfo!.nodes[targetId];
                        if (!targetNode) return;


                    // Helper to find the actual bottom of a node (below label or below lexical item)
                    const getBottomY = (n: typeof node, p: typeof pStart) => {
                        if (n.isTriangle) {
                            return p.y + LAYOUT_CONFIG.levelHeight + 40; // Spans 70px + 25px text offset + 15px padding
                        }
                        if (n.childrenIds.length === 0 && n.lexicalItem && n.lexicalItem.trim() !== "") {
                            return p.y + 40; // 25 (lexical Y offset) + 15 padding
                        }
                        return p.y + 20; // 15 (half of 30) + 5 padding below the label
                    };

                    const startY = getBottomY(node, pStart);
                    const endY = getBottomY(targetNode, pEnd);

                    // Calculate control points for a smooth bottom arc curve
                    const dx = pEnd.x - pStart.x;
                    const span = Math.abs(dx);

                    // Find the lowest node horizontally between start and end to avoid crossing it
                    const minX = Math.min(pStart.x, pEnd.x);
                    const maxX = Math.max(pStart.x, pEnd.x);
                    let maxInterveningY = Math.max(startY, endY);

                    Object.keys(this.positions).forEach(id => {
                        const pos = this.positions[id];
                        if (pos.x > minX - 20 && pos.x < maxX + 20) {
                            const n = this.treeInfo!.nodes[id];
                            if (n) {
                                const nBottom = getBottomY(n, pos);
                                if (nBottom > maxInterveningY) {
                                    maxInterveningY = nBottom;
                                }
                            }
                        }
                    });

                    // Ensure minimum visual dip based on distance, but also guarantee clearing the lowest node
                    const distanceDipCurved = Math.max(120, span * 0.5);
                    // Make orthogonal drop much smaller by default so it stays close to the text
                    const distanceDipOrtho = Math.max(15, span * 0.05);
                    const requiredCpY = maxInterveningY + 30; // Reduced clearance from the lowest node

                    let d = '';
                    let midX = 0, midY = 0;

                    if (traceStyle === 'orthogonal') {
                        let dropY = Math.max(startY + distanceDipOrtho, endY + distanceDipOrtho, requiredCpY);

                        // Check for collisions with previously drawn horizontal trace segments
                        let isColliding = true;
                        while (isColliding) {
                            isColliding = horizontalSegments.some(seg => {
                                // Check if horizontal spans overlap
                                const overlapX = (minX <= seg.maxX && maxX >= seg.minX);
                                // Check if vertical positions are too close (within 10 px)
                                const overlapY = Math.abs(seg.y - dropY) < 10;
                                return overlapX && overlapY;
                            });

                            if (isColliding) {
                                dropY += 15; // Push down by 15px if there's a collision
                            }
                        }
                        horizontalSegments.push({ minX, maxX, y: dropY });

                        // Array of preferred offsets: center, then left/right alternating and growing
                        const preferredOffsets = [0, -10, 10, -20, 20, -30, 30, -40, 40, -50, 50];

                        // Check for collisions with previously drawn vertical trace segments (Start Point)
                        let startOffsetX = 0;
                        for (const offset of preferredOffsets) {
                            const currentStartX = pStart.x + offset;
                            const isColliding = verticalSegments.some(seg => {
                                const overlapX = Math.abs(seg.x - currentStartX) < 9; // 9px clearance to avoid rounding issues
                                const overlapY = (startY <= seg.maxY && dropY >= seg.minY) || (dropY <= seg.maxY && startY >= seg.minY);
                                return overlapX && overlapY;
                            });
                            if (!isColliding) {
                                startOffsetX = offset;
                                break;
                            }
                        }
                        const finalStartX = pStart.x + startOffsetX;
                        verticalSegments.push({ x: finalStartX, minY: Math.min(startY, dropY), maxY: Math.max(startY, dropY) });

                        // Check for collisions with previously drawn vertical trace segments (End Point)
                        let endOffsetX = 0;
                        for (const offset of preferredOffsets) {
                            const currentEndX = pEnd.x + offset;
                            const isColliding = verticalSegments.some(seg => {
                                const overlapX = Math.abs(seg.x - currentEndX) < 9;
                                const overlapY = (endY <= seg.maxY && dropY >= seg.minY) || (dropY <= seg.maxY && endY >= seg.minY);
                                return overlapX && overlapY;
                            });
                            if (!isColliding) {
                                endOffsetX = offset;
                                break;
                            }
                        }
                        const finalEndX = pEnd.x + endOffsetX;
                        verticalSegments.push({ x: finalEndX, minY: Math.min(endY, dropY), maxY: Math.max(endY, dropY) });

                        d = `M ${finalStartX} ${startY} L ${finalStartX} ${dropY} L ${finalEndX} ${dropY} L ${finalEndX} ${endY}`;
                        midX = (finalStartX + finalEndX) / 2;
                        midY = dropY;
                    } else {
                        // Similar potential offset for curved traces' control points if needed, but they usually don't overlap as sharply
                        const cp1X = pStart.x;
                        const cp1Y = Math.max(startY + distanceDipCurved, requiredCpY + 50);
                        const cp2X = pEnd.x;
                        const cp2Y = Math.max(endY + distanceDipCurved, requiredCpY + 50);

                        d = `M ${pStart.x} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${pEnd.x} ${endY}`;
                        midX = 0.125 * pStart.x + 0.375 * cp1X + 0.375 * cp2X + 0.125 * pEnd.x;
                        midY = 0.125 * startY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * endY;
                    }

                    const isSelectedTrace = this.selectedTrace?.sourceId === node.id && this.selectedTrace?.targetId === targetId;

                    const traceGroup = document.createElementNS(ns, "g");
                    traceGroup.style.cursor = "pointer";
                    traceGroup.style.pointerEvents = "all";

                    // Thicker transparent hitbox for easier clicking
                    const hitboxPath = document.createElementNS(ns, "path");
                    hitboxPath.setAttribute("d", d);
                    hitboxPath.setAttribute("fill", "transparent");
                    hitboxPath.setAttribute("stroke", "transparent");
                    hitboxPath.setAttribute("stroke-width", "15");

                    const path = document.createElementNS(ns, "path");
                    path.setAttribute("d", d);
                    path.setAttribute("fill", "transparent");
                    path.setAttribute("stroke", isSelectedTrace ? "#9b59b6" : "#8e44ad"); // Lighter purple if selected
                    path.setAttribute("stroke-width", isSelectedTrace ? "4" : "2");
                    if (isDashed) {
                        path.setAttribute("stroke-dasharray", "5,5");
                    }
                    path.setAttribute("marker-end", `url(#${this.markerId})`);
                    path.style.pointerEvents = "none";

                    traceGroup.appendChild(hitboxPath);
                    traceGroup.appendChild(path);

                    traceGroup.addEventListener("pointerdown", (e) => {
                        if (this.isReadOnly) return; // Let the background pan instead
                        e.stopPropagation(); // Prevet drag
                        if (isSelectedTrace) {
                            this.selectedTrace = null;
                        } else {
                            this.selectedTrace = { sourceId: node.id, targetId };
                            this.selectedId = null;
                            this.editingId = null;
                        }
                        this.container.innerHTML = '';
                        this.drawSVG();
                    });

                    linesGroup.appendChild(traceGroup);

                    // If this trace is selected, draw a delete button, retarget button, and style toggle button at its visual midpoint
                    if (isSelectedTrace) {
                        // Delete button
                        const btnDelete = document.createElementNS(ns, "g") as SVGGElement;
                        btnDelete.style.cursor = "pointer";
                        btnDelete.style.pointerEvents = "all";

                        const delHitBox = document.createElementNS(ns, "rect");
                        delHitBox.setAttribute("x", (midX - 75).toString());
                        delHitBox.setAttribute("y", (midY - 15).toString());
                        delHitBox.setAttribute("width", "30");
                        delHitBox.setAttribute("height", "30");
                        delHitBox.setAttribute("fill", "transparent");

                        const bgCircle1 = document.createElementNS(ns, "circle");
                        bgCircle1.setAttribute("cx", (midX - 60).toString());
                        bgCircle1.setAttribute("cy", midY.toString());
                        bgCircle1.setAttribute("r", "14");
                        bgCircle1.setAttribute("fill", "#242424");
                        bgCircle1.style.pointerEvents = "none";

                        const textDel = document.createElementNS(ns, "text") as SVGTextElement;
                        textDel.setAttribute("x", (midX - 60).toString());
                        textDel.setAttribute("y", (midY + 2).toString());
                        textDel.setAttribute("text-anchor", "middle");
                        textDel.setAttribute("dominant-baseline", "middle");
                        textDel.setAttribute("fill", "#e74c3c");
                        textDel.setAttribute("font-weight", "900");
                        textDel.setAttribute("font-size", "22px");
                        textDel.textContent = "t̶";
                        textDel.style.pointerEvents = "none";

                        btnDelete.addEventListener("mouseenter", () => { textDel.setAttribute("font-size", "30px"); });
                        btnDelete.addEventListener("mouseleave", () => { textDel.setAttribute("font-size", "22px"); });

                        btnDelete.appendChild(delHitBox);
                        btnDelete.appendChild(bgCircle1);
                        btnDelete.appendChild(textDel);

                        btnDelete.addEventListener("mousedown", (e) => { e.stopPropagation(); });
                        btnDelete.addEventListener("click", (e) => {
                            e.stopPropagation();
                            if (this.onTraceDelete) this.onTraceDelete(node.id, targetId);
                            this.selectedTrace = null;
                            this.container.innerHTML = '';
                            this.drawSVG();
                        });

                        // Toggle Style button
                        const btnStyle = document.createElementNS(ns, "g") as SVGGElement;
                        btnStyle.style.cursor = "pointer";
                        btnStyle.style.pointerEvents = "all";

                        const styleHitBox = document.createElementNS(ns, "rect");
                        styleHitBox.setAttribute("x", (midX - 35).toString());
                        styleHitBox.setAttribute("y", (midY - 15).toString());
                        styleHitBox.setAttribute("width", "30");
                        styleHitBox.setAttribute("height", "30");
                        styleHitBox.setAttribute("fill", "transparent");

                        const bgCircleStyle = document.createElementNS(ns, "circle");
                        bgCircleStyle.setAttribute("cx", (midX - 20).toString());
                        bgCircleStyle.setAttribute("cy", midY.toString());
                        bgCircleStyle.setAttribute("r", "14");
                        bgCircleStyle.setAttribute("fill", "#242424");
                        bgCircleStyle.style.pointerEvents = "none";

                        const textStyle = document.createElementNS(ns, "text") as SVGTextElement;
                        textStyle.setAttribute("x", (midX - 20).toString());
                        textStyle.setAttribute("y", (midY + 2).toString());
                        textStyle.setAttribute("text-anchor", "middle");
                        textStyle.setAttribute("dominant-baseline", "middle");
                        textStyle.setAttribute("fill", "#f39c12"); // Orange color
                        textStyle.setAttribute("font-weight", "900");
                        textStyle.setAttribute("font-size", "16px");
                        textStyle.textContent = traceStyle === 'curved' ? "⎍" : "∪"; // Square/Curve icon
                        textStyle.style.pointerEvents = "none";

                        btnStyle.addEventListener("mouseenter", () => { textStyle.setAttribute("font-size", "22px"); });
                        btnStyle.addEventListener("mouseleave", () => { textStyle.setAttribute("font-size", "16px"); });

                        btnStyle.appendChild(styleHitBox);
                        btnStyle.appendChild(bgCircleStyle);
                        btnStyle.appendChild(textStyle);

                        btnStyle.addEventListener("mousedown", (e) => { e.stopPropagation(); });
                        btnStyle.addEventListener("click", (e) => {
                            e.stopPropagation();
                            if (this.onTraceStyleToggle) this.onTraceStyleToggle(node.id, targetId);
                        });

                        // Dash Toggle button
                        const btnDash = document.createElementNS(ns, "g") as SVGGElement;
                        btnDash.style.cursor = "pointer";
                        btnDash.style.pointerEvents = "all";

                        const dashHitBox = document.createElementNS(ns, "rect");
                        dashHitBox.setAttribute("x", (midX + 5).toString());
                        dashHitBox.setAttribute("y", (midY - 15).toString());
                        dashHitBox.setAttribute("width", "30");
                        dashHitBox.setAttribute("height", "30");
                        dashHitBox.setAttribute("fill", "transparent");

                        const bgCircleDash = document.createElementNS(ns, "circle");
                        bgCircleDash.setAttribute("cx", (midX + 20).toString());
                        bgCircleDash.setAttribute("cy", midY.toString());
                        bgCircleDash.setAttribute("r", "14");
                        bgCircleDash.setAttribute("fill", "#242424");
                        bgCircleDash.style.pointerEvents = "none";

                        const textDash = document.createElementNS(ns, "text") as SVGTextElement;
                        textDash.setAttribute("x", (midX + 20).toString());
                        textDash.setAttribute("y", (midY + 2).toString());
                        textDash.setAttribute("text-anchor", "middle");
                        textDash.setAttribute("dominant-baseline", "middle");
                        textDash.setAttribute("fill", "#3498db"); // Blue color
                        textDash.setAttribute("font-weight", "900");
                        textDash.setAttribute("font-size", "14px");
                        textDash.textContent = isDashed ? "—" : "---";
                        textDash.style.pointerEvents = "none";

                        btnDash.addEventListener("mouseenter", () => { textDash.setAttribute("font-size", "20px"); });
                        btnDash.addEventListener("mouseleave", () => { textDash.setAttribute("font-size", "14px"); });

                        btnDash.appendChild(dashHitBox);
                        btnDash.appendChild(bgCircleDash);
                        btnDash.appendChild(textDash);

                        btnDash.addEventListener("mousedown", (e) => { e.stopPropagation(); });
                        btnDash.addEventListener("click", (e) => {
                            e.stopPropagation();
                            if (this.onTraceDashToggle) this.onTraceDashToggle(node.id, targetId);
                        });

                        // Retarget button
                        const btnRetarget = document.createElementNS(ns, "g") as SVGGElement;
                        btnRetarget.style.cursor = "pointer";
                        btnRetarget.style.pointerEvents = "all";

                        const retHitBox = document.createElementNS(ns, "rect");
                        retHitBox.setAttribute("x", (midX + 45).toString());
                        retHitBox.setAttribute("y", (midY - 15).toString());
                        retHitBox.setAttribute("width", "30");
                        retHitBox.setAttribute("height", "30");
                        retHitBox.setAttribute("fill", "transparent");

                        const bgCircle2 = document.createElementNS(ns, "circle");
                        bgCircle2.setAttribute("cx", (midX + 60).toString());
                        bgCircle2.setAttribute("cy", midY.toString());
                        bgCircle2.setAttribute("r", "14");
                        bgCircle2.setAttribute("fill", "#242424");
                        bgCircle2.style.pointerEvents = "none";

                        const textRet = document.createElementNS(ns, "text") as SVGTextElement;
                        textRet.setAttribute("x", (midX + 60).toString());
                        textRet.setAttribute("y", (midY + 2).toString());
                        textRet.setAttribute("text-anchor", "middle");
                        textRet.setAttribute("dominant-baseline", "middle");
                        textRet.setAttribute("fill", "#f1c40f");
                        textRet.setAttribute("font-weight", "900");
                        textRet.setAttribute("font-size", "22px");
                        textRet.textContent = "↗"; // Arrow up right
                        textRet.style.pointerEvents = "none";

                        btnRetarget.addEventListener("mouseenter", () => { textRet.setAttribute("font-size", "30px"); });
                        btnRetarget.addEventListener("mouseleave", () => { textRet.setAttribute("font-size", "22px"); });

                        btnRetarget.appendChild(retHitBox);
                        btnRetarget.appendChild(bgCircle2);
                        btnRetarget.appendChild(textRet);

                        btnRetarget.addEventListener("mousedown", (e) => { e.stopPropagation(); });
                        btnRetarget.addEventListener("click", (e) => {
                            e.stopPropagation();
                            // Delete old trace
                            if (this.onTraceDelete) this.onTraceDelete(node.id, targetId);
                            this.selectedTrace = null;
                            // Enter drawing mode for this node
                            this.isDrawingTraceOriginId = node.id;
                            this.container.innerHTML = '';
                            this.drawSVG();
                        });

                        uiGroup.appendChild(btnDelete);
                        uiGroup.appendChild(btnStyle);
                        uiGroup.appendChild(btnDash);
                        uiGroup.appendChild(btnRetarget);
                    }
                    } catch (e) {
                         console.error("Error drawing trace: ", e);
                    }
                });
            }
        });

        if (this.isDrawingTraceOriginId) {
            this.tracePreviewPath = document.createElementNS(ns, "path");
            this.tracePreviewPath.setAttribute("fill", "transparent");
            this.tracePreviewPath.setAttribute("stroke", "#8e44ad"); // Purple
            this.tracePreviewPath.setAttribute("stroke-width", "2");
            this.tracePreviewPath.setAttribute("stroke-dasharray", "5,5");
            this.tracePreviewPath.setAttribute("marker-end", `url(#${this.markerId})`);
            this.tracePreviewPath.style.pointerEvents = "none";
            linesGroup.appendChild(this.tracePreviewPath);
        } else {
            this.tracePreviewPath = null;
        }

        // Draw Nodes
        Object.values(this.treeInfo.nodes).forEach(node => {
            const basePos = this.positions[node.id];
            if (!basePos) return;

            let currentX = basePos.x;
            let currentY = basePos.y;

            const isSelected = this.selectedId === node.id; // Ignore isDragging here

            // Container for the node
            const nodeG = document.createElementNS(ns, "g") as SVGGElement;
            nodeG.setAttribute("id", `node-${node.id}`);
            nodeG.style.cursor = "grab";

            const isLeafNode = node.childrenIds.length === 0;

            const nodeWidth = this.nodeWidths[node.id] || LAYOUT_CONFIG.nodeWidth;
            // For the visual selection rect and hitbox, use only the node's own text width, not the subtree width
            const labelText = node.label || "";
            const lexText = node.lexicalItem || "";
            const visualLabelLen = getVisualLength(labelText);
            const visualLexLen = getVisualLength(lexText);
            const longestVisualLen = Math.max(visualLabelLen, visualLexLen);
            const visualWidth = Math.max(LAYOUT_CONFIG.nodeWidth, longestVisualLen * 8 + 30);
            // Expanded hitBox height for triangle nodes to cover the triangle and the Phrase text
            const hitBoxHeight = node.isTriangle ? (LAYOUT_CONFIG.levelHeight + 50) : (isLeafNode ? 90 : 60);

            // Dedicated invisible wrapper hitbox
            const hitBox = document.createElementNS(ns, "rect");
            hitBox.setAttribute("class", "droppable"); // Used by elementsFromPoint
            hitBox.dataset.droptarget = node.id;
            // Generous hitbox to make clicking very easy
            hitBox.setAttribute("x", (currentX - visualWidth / 2).toString());
            hitBox.setAttribute("y", (currentY - 15).toString());
            hitBox.setAttribute("width", visualWidth.toString());
            hitBox.setAttribute("height", hitBoxHeight.toString());
            hitBox.setAttribute("fill", "transparent");
            hitBox.style.pointerEvents = "all";

            const isAlias = node.label.includes('|');

            // Background rect for selection highlight and drop targeting (visual)
            const bgRect = document.createElementNS(ns, "rect");
            bgRect.setAttribute("id", `bgrect-${node.id}`);
            bgRect.setAttribute("class", "bg-rect-target"); // Used to clear highlights
            bgRect.setAttribute("data-isselected", isSelected.toString());
            bgRect.setAttribute("x", (currentX - visualWidth / 2).toString());
            bgRect.setAttribute("y", (currentY - 20).toString());
            bgRect.setAttribute("width", visualWidth.toString());
            bgRect.setAttribute("height", hitBoxHeight.toString());
            bgRect.setAttribute("rx", "5");

            bgRect.setAttribute("fill", isSelected ? "#3498db" : "white");
            bgRect.setAttribute("opacity", isSelected ? "0.3" : "0");

            nodeG.appendChild(bgRect);

            const interactiveGroup = document.createElementNS(ns, "g");
            interactiveGroup.appendChild(bgRect);

            if (this.editingId === node.id) {
                // Use a very large foreignObject to prevent browser clipping of em-based content.
                // The actual background and layout will be contained tightly by the HTML div inside.
                const foWidth = 800;
                const foHeight = 150;

                const fo = document.createElementNS(ns, "foreignObject");
                fo.setAttribute("x", (currentX - (foWidth / 2)).toString());
                fo.setAttribute("y", (currentY - 15).toString());
                fo.setAttribute("width", foWidth.toString());
                fo.setAttribute("height", foHeight.toString());
                fo.style.overflow = "visible"; // Attempt to prevent internal clipping
                fo.style.pointerEvents = "all"; // Crucial: Re-enable pointer events since uiGroup disables them

                const form = document.createElement("div");
                form.style.display = "flex";
                form.style.flexDirection = "column";
                form.style.gap = "0.2em"; 
                form.style.width = "max-content"; 
                form.style.margin = "0 auto"; 
                form.style.justifyContent = "flex-start"; 
                form.style.alignItems = "center";
                form.style.background = "#2a2a2a"; 
                form.style.padding = "0.4em"; 
                form.style.borderRadius = "0.4em"; 
                form.style.boxShadow = "0 4px 6px rgba(0,0,0,0.5)"; // Add shadow to stand out

                // 1. Label Input First (Top)
                // Use px for canvas measurement (1.2em ≈ 19px, 1.1em ≈ 18px at default 16px base)
                const labelFont = `${this._settings.labelBold ? 'bold' : 'normal'} ${this._settings.labelFontSize + 1}px ${this._settings.fontFamily}`;
                const lexicalFont = `${this._settings.lexicalItalic ? 'italic' : 'normal'} ${this._settings.lexicalFontSize + 2}px ${this._settings.fontFamily}`;

                const inputLabel = document.createElement("input");
                inputLabel.type = "text";
                inputLabel.value = node.label;
                inputLabel.placeholder = t('ui_node_label_placeholder');
                inputLabel.style.textAlign = "center";
                inputLabel.style.border = "2px solid #3498db"; 
                inputLabel.style.borderRadius = "0.3em";
                inputLabel.style.fontWeight = this._settings.labelBold ? "bold" : "normal";
                inputLabel.style.fontSize = "1.2em"; 
                inputLabel.style.boxSizing = "border-box";
                inputLabel.style.padding = "0.2em 0.5em";
                inputLabel.style.backgroundColor = "#1a1a1a"; 
                inputLabel.style.color = "white";
                inputLabel.style.width = "100%";
                form.appendChild(inputLabel);

                let inputLexical: HTMLInputElement | null = null;

                // Pixel-accurate text measurement via offscreen canvas
                const measureCanvas = document.createElement("canvas");
                const measureCtx = measureCanvas.getContext("2d")!;
                const measureText = (text: string, font: string): number => {
                    measureCtx.font = font;
                    return measureCtx.measureText(text).width;
                };

                const MIN_INPUT_WIDTH = 80; // px minimum
                const PADDING_PX = 36; // horizontal padding + border buffer

                const updateWidths = () => {
                    const labelText = inputLabel.value || inputLabel.placeholder;
                    const labelPx = measureText(labelText, labelFont);

                    let lexicalPx = 0;
                    if (inputLexical) {
                        const lexText = inputLexical.value || inputLexical.placeholder;
                        lexicalPx = measureText(lexText, lexicalFont);
                    }

                    const maxPx = Math.max(labelPx, lexicalPx, MIN_INPUT_WIDTH) + PADDING_PX;
                    form.style.width = maxPx + "px";
                };

                inputLabel.addEventListener('input', updateWidths);
                
                // 2. Lexical Input Second (Bottom)
                const isTriangle = !!node.isTriangle;
                if (isLeafNode || isTriangle) {
                    inputLexical = document.createElement("input");
                    inputLexical.type = "text";
                    inputLexical.value = node.lexicalItem || "";
                    inputLexical.placeholder = isTriangle ? t('ui_node_phrase_placeholder') : t('ui_node_word_placeholder');
                    inputLexical.style.textAlign = "center";
                    inputLexical.style.border = "2px solid #f39c12"; 
                    inputLexical.style.borderRadius = "0.3em";
                    inputLexical.style.fontSize = "1.1em"; 
                    inputLexical.style.boxSizing = "border-box";
                    inputLexical.style.padding = "0.2em 0.5em";
                    inputLexical.style.backgroundColor = "#1a1a1a";
                    inputLexical.style.color = "white";
                    inputLexical.style.width = "100%";
                    inputLexical.addEventListener('input', updateWidths);
                    form.appendChild(inputLexical);
                }

                // Initial width sync
                updateWidths();

                let isCancelled = false;

                const saveEdits = () => {
                    if (isCancelled) return;
                    isCancelled = true; // Prevent double saving if both inputs blur

                    const newLabel = inputLabel.value.trim();
                    let newLexical = node.lexicalItem;
                    if (inputLexical) {
                        newLexical = inputLexical.value.trim();
                    }

                    // Clear editing state first so re-render doesn't redraw the form
                    if (this.editingId === node.id) {
                        this.editingId = null;
                    }

                    if (this.onLabelChange) {
                        this.onLabelChange(node.id, newLabel, newLexical);
                    } else {
                        // Fallback redraw if no external handler
                        this.container.innerHTML = '';
                        this.drawSVG();
                    }
                };

                // We DO NOT stop pointerdown on the form anymore. 
                // Let the browser handle focus and keyboard opening natively.
                // To prevent panning the SVG map when clicking the form, 
                // we'll handle that in the global svg.pointerdown event.

                form.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdits();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        isCancelled = true;
                        if (this.editingId === node.id) {
                            this.editingId = null;
                            this.container.innerHTML = '';
                            this.drawSVG();
                        }
                    }
                });

                const handleBlur = (e: FocusEvent) => {
                    // Check if focus is just moving between the two inputs in our form
                    if (e.relatedTarget && (e.relatedTarget === inputLabel || (inputLexical && e.relatedTarget === inputLexical))) {
                        return;
                    }
                    saveEdits();
                };

                inputLabel.addEventListener("blur", handleBlur);
                if (inputLexical) inputLexical.addEventListener("blur", handleBlur);

                fo.appendChild(form);
                uiGroup.appendChild(fo); // Appending to uiGroup draws it strictly over all nodes and hitboxes

                // Call focus directly, not in timeout, so mobile browsers know it's user-initiated
                // Use setTimeout with 0 to allow DOM to genuinely render the input before focusing
                // which fixes the "needs refresh to work" bug on iOS
                setTimeout(() => {
                    inputLabel.focus();
                    inputLabel.select();
                }, 10);

                // Backup for strict mobile browsers (iOS Safari): force focus on touchend/click
                form.addEventListener("touchend", () => {
                    inputLabel.focus();
                }, { passive: false });
            } else {
                const textLabel = document.createElementNS(ns, "text") as SVGTextElement;
                textLabel.setAttribute("x", currentX.toString());
                textLabel.setAttribute("y", currentY.toString());
                textLabel.setAttribute("text-anchor", "middle");
                textLabel.setAttribute("dominant-baseline", "middle");

                const isEmpty = !node.label || node.label.trim() === "";
                const displayLabel = isEmpty ? (this._settings.showPlaceholders ? "?" : "") : node.label;

                // Red if empty ('?'), blue if selected, soft blue if alias, user color otherwise
                let labelColor = this._settings.labelColor;
                if (isSelected) labelColor = "#3498db";
                else if (displayLabel === "?") labelColor = "#ff4444";
                else if (isAlias) labelColor = "#5ba3d9"; // Soft blue for alias nodes

                textLabel.setAttribute("fill", labelColor);
                textLabel.setAttribute("font-weight", this._settings.labelBold ? "bold" : "normal");
                textLabel.setAttribute("font-size", `${this._settings.labelFontSize}px`);
                if (this._settings.fontFamily !== 'system-ui, sans-serif') {
                    textLabel.setAttribute("font-family", this._settings.fontFamily);
                }
                renderFormattedTextToSVG(textLabel, displayLabel, this._settings.labelFontSize, ns);
                textLabel.style.pointerEvents = "none";
                interactiveGroup.appendChild(textLabel);

                if (node.isTriangle) {
                    const triangle = document.createElementNS(ns, "polygon");
                    const yBottom = currentY + LAYOUT_CONFIG.levelHeight;
                    const halfWidth = (nodeWidth - 10) / 2;
                    const points = `${currentX},${currentY + 14} ${currentX - halfWidth},${yBottom} ${currentX + halfWidth},${yBottom}`;
                    triangle.setAttribute("points", points);
                    triangle.setAttribute("fill", "none");
                    triangle.setAttribute("stroke", isSelected ? "#3498db" : this._settings.lineColor); // Blue if selected
                    triangle.setAttribute("stroke-width", "2");
                    triangle.style.pointerEvents = "none";
                    interactiveGroup.appendChild(triangle);
                }

                // Draw lexical item if leaf or triangle
                const isTriangle = !!node.isTriangle;
                if ((isLeafNode || isTriangle) && (node.lexicalItem !== undefined || isTriangle)) {
                    // Triangle text goes to word level (levelHeight + 25)
                    const lexY = isTriangle ? (currentY + LAYOUT_CONFIG.levelHeight + 25) : (currentY + 25);

                    const displayLexical = node.lexicalItem?.trim() || "";
                    if (displayLexical !== "" || isTriangle) {
                        const textLex = document.createElementNS(ns, "text") as SVGTextElement;
                        textLex.setAttribute("x", currentX.toString());
                        textLex.setAttribute("y", lexY.toString());
                        textLex.setAttribute("text-anchor", "middle");
                        textLex.setAttribute("dominant-baseline", "middle");

                        let lexColor = this._settings.lexicalColor;
                        if (isSelected) lexColor = "#f39c12";

                        textLex.setAttribute("fill", lexColor);
                        textLex.setAttribute("font-size", `${this._settings.lexicalFontSize}px`);
                        if (this._settings.lexicalItalic) {
                            textLex.setAttribute("font-style", "italic");
                        }
                        if (this._settings.fontFamily !== 'system-ui, sans-serif') {
                            textLex.setAttribute("font-family", this._settings.fontFamily);
                        }
                        const textContent = isTriangle && displayLexical === "" ? "" : displayLexical;
                        renderFormattedTextToSVG(textLex, textContent, this._settings.lexicalFontSize, ns);
                        textLex.style.pointerEvents = "none";
                        interactiveGroup.appendChild(textLex);
                    }
                }
            }

            nodeG.appendChild(interactiveGroup);

            // Append hitBox LAST so it's on top
            nodeG.appendChild(hitBox);

            // Highlight node if waiting for trace target
            if (this.isDrawingTraceOriginId && this.isDrawingTraceOriginId !== node.id) {
                hitBox.style.cursor = "crosshair";
            }

            // Setup Drag and Drop events attached to the hitBox specifically
            hitBox.addEventListener("pointerdown", (e) => {
                if (this.isReadOnly) return;

                // Prevent default ONLY if it's not a touch event, to allow mobile browsers 
                // to correctly handle the sequence of touchstart -> touchend -> click -> focus
                if (e.pointerType !== 'touch') {
                    // Preclude ghost dragging on desktop
                }

                if (this.editingId && this.editingId !== node.id) {
                    // If we're editing something else, clicking here should just blur the other thing
                    // We don't want to immediately select this node and destroy the other input before it saves.
                    // The blur event of the other element will handle saving and re-rendering.
                    return;
                }

                if (e.button !== 0) return; // Only process left click
                e.stopPropagation();

                // If waiting for trace target
                if (this.isDrawingTraceOriginId) {
                    if (this.isDrawingTraceOriginId !== node.id && this.onTraceCreate) {
                        this.onTraceCreate(this.isDrawingTraceOriginId, node.id);
                    }
                    this.isDrawingTraceOriginId = null;
                    this.render(this.treeInfo!); // Redraw
                    return;
                }

                // If editing another node, close it first and process the new click immediately via redraw
                if (this.editingId && this.editingId !== node.id) {
                    this.editingId = null;
                    if (this.onElementClick) this.onElementClick(node.id, false); // Select the new node
                    this.container.innerHTML = '';
                    this.drawSVG();
                    return;
                }

                this.clearLongPressTimer();
                this.longPressTimer = setTimeout(() => {
                    // Trigger edit mode via Long Press
                    if (!this.hasMoved && this.isDragging && this.draggedNodeId === node.id) {
                        this.editingId = node.id;
                        this.isDragging = false; // Stop dragging if editing starts
                        this.draggedNodeId = null;
                        this.container.innerHTML = '';
                        this.drawSVG();
                    }
                }, this.longPressDelay);

                const now = Date.now();
                const isDoubleClick = (now - this.lastClickTime < 300) && (this.lastClickedId === node.id);

                if (isDoubleClick) {
                    // It's a double click - trigger edit and exit drag setup
                    this.lastClickTime = 0;
                    this.lastClickedId = null;
                    this.editingId = node.id;
                    this.container.innerHTML = '';
                    this.drawSVG();
                    return; // Prevent drag start
                }

                this.lastClickTime = now;
                this.lastClickedId = node.id;

                // Track pointer for multi-touch
                this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY });

                // ALWAYS add cleanup listeners before any early returns to avoid leaks
                window.addEventListener("pointermove", this.boundPointerMove);
                window.addEventListener("pointerup", this.boundPointerUp);
                window.addEventListener("pointercancel", this.boundPointerUp);

                // Select on mouse down
                if (this.onElementClick) this.onElementClick(node.id, false);

                if (this.activePointers.size > 1) {
                    this.clearLongPressTimer();
                    this.isDragging = false;
                    this.draggedNodeId = null;
                    this.lastPinchDistance = null;
                    return;
                }

                this.isDragging = true;
                this.draggedNodeId = node.id;
                this.dragStartX = e.pageX;
                this.dragStartY = e.pageY;
                this.dragOffsetX = 0;
                this.dragOffsetY = 0;
                this.hasMoved = false;

                // Close the floating UI during drag
                if (uiGroup) uiGroup.innerHTML = '';
            });

            nodesGroup.appendChild(nodeG);

            // Draw floating controls if selected and not dragging
            if (isSelected && this.editingId !== node.id && !this.isReadOnly) {
                const isLeaf = node.childrenIds.length === 0;
                const hasWord = !!(node.lexicalItem && node.lexicalItem.trim() !== "");
                this.drawFloatingControls(uiGroup, ns, currentX, currentY, node, isLeaf, hasWord);
            }
        });

        // Draw Tokens loop deleted

        // Background click to deselect
        svg.addEventListener("pointerdown", (e) => {
            // STOP PANNING if clicking on the popup form inside uiGroup
            const isClickingForm = e.target instanceof Element && (e.target.closest('foreignObject') || e.target.tagName.toLowerCase() === 'input');
            if (isClickingForm) {
                return; // Let the form handle it naturally
            }

            if (this.editingId) return; // Wait for blur to finish saving

            const isBackground = e.target === svg || e.target === viewport || e.target === uiGroup || e.target === linesGroup;

            if (isBackground || this.isReadOnly) {
                // Double click to center
                const now = Date.now();
                const isDoubleClick = (now - this.lastClickTime < 300) && (this.lastClickedId === 'background');
                
                if (isDoubleClick) {
                    this.lastClickTime = 0;
                    this.lastClickedId = null;
                    this.centerView();
                    return;
                }
                
                this.lastClickTime = now;
                this.lastClickedId = 'background';

                // Cancel trace drawing if clicking on background
                if (this.isDrawingTraceOriginId) {
                    this.isDrawingTraceOriginId = null;
                    this.render(this.treeInfo!);
                    return;
                }

                if (this.selectedTrace) {
                    this.selectedTrace = null;
                    this.container.innerHTML = '';
                    this.drawSVG();
                    return; // Stop right here, dont pan immediately let them just deselect
                }

                if (this.onBackgroundClick) {
                    this.onBackgroundClick();
                }

                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.startPanX = this.panX;
                this.startPanY = this.panY;

                // Track pointer for multi-touch
                this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY });

                if (this.activePointers.size > 1) {
                    this.isPanning = false;
                    this.lastPinchDistance = null;
                }

                window.addEventListener("pointermove", this.boundPointerMove);
                window.addEventListener("pointerup", this.boundPointerUp);
                window.addEventListener("pointercancel", this.boundPointerUp);
            }
        });

        // Wheel Zoom Support (Figma-style)
        svg.addEventListener("wheel", (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.1 : 0.9;
                this.zoomAt(e.clientX, e.clientY, factor);
            }
        }, { passive: false });

        // Touch support is now natively handled by pointerdown events.

        // Show grab icon when hovering empty space
        svg.style.cursor = 'grab';

        // CRITICAL FOR MOBILE PANNING: Prevent browser from taking over touch drag for scrolling
        svg.style.touchAction = 'none';

        // Trace preview interaction
        svg.addEventListener("pointermove", (e) => {
            if (!this.isDrawingTraceOriginId || !this.tracePreviewPath) return;

            const rect = svg.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
            const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

            const pStart = this.positions[this.isDrawingTraceOriginId];
            if (!pStart) return;

            const node = this.treeInfo!.nodes[this.isDrawingTraceOriginId];

            const getBottomY = (n: any, p: any) => {
                if (n.isTriangle) {
                    return p.y + LAYOUT_CONFIG.levelHeight + 40;
                }
                if (n.childrenIds.length === 0 && n.lexicalItem && n.lexicalItem.trim() !== "") {
                    return p.y + 40;
                }
                return p.y + 20;
            };

            const startY = getBottomY(node, pStart);

            const dx = mouseX - pStart.x;
            const span = Math.abs(dx);

            // Find the lowest node horizontally between start and mouseX to avoid crossing it
            const minX = Math.min(pStart.x, mouseX);
            const maxX = Math.max(pStart.x, mouseX);
            let maxInterveningY = Math.max(startY, mouseY);

            Object.keys(this.positions).forEach(id => {
                const pos = this.positions[id];
                if (pos.x > minX - 20 && pos.x < maxX + 20) {
                    const n = this.treeInfo!.nodes[id];
                    if (n) {
                        const nBottom = getBottomY(n, pos);
                        if (nBottom > maxInterveningY) {
                            maxInterveningY = nBottom;
                        }
                    }
                }
            });

            // Ensure minimum visual dip based on distance, but also guarantee clearing the lowest node
            const distanceDip = Math.max(120, span * 0.5);
            const requiredCpY = maxInterveningY + 80;

            const cp1X = pStart.x;
            const cp1Y = Math.max(startY + distanceDip, requiredCpY);
            const cp2X = mouseX;
            const cp2Y = Math.max(mouseY + distanceDip, requiredCpY);

            const d = `M ${pStart.x} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${mouseX} ${mouseY}`;
            this.tracePreviewPath.setAttribute("d", d);
        });

        this.container.appendChild(svg);

        // Add Floating Actions Group (Zoom, Center) in the bottom-right corner
        const fabGroup = document.createElement("div");
        fabGroup.className = "fab-group";

        const createFAB = (icon: string, title: string, onClick: (e: MouseEvent) => void) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "fab-button";
            btn.innerHTML = icon;
            btn.title = title;
            btn.addEventListener("pointerdown", (e) => e.stopPropagation()); 
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick(e);
            });
            return btn;
        };

        const undoIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>`;
        const redoIcon = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>`;

        if (!this.isReadOnly) {
            fabGroup.appendChild(createFAB(undoIcon, t('ui_fab_undo'), () => { if (this.onUndo) this.onUndo(); }));
            fabGroup.appendChild(createFAB(redoIcon, t('ui_fab_redo'), () => { if (this.onRedo) this.onRedo(); }));
        }
        
        // Separator logic could be added here if needed, but a gap is enough
        fabGroup.appendChild(createFAB("+", t('ui_fab_zoom_in'), () => this.zoomIn()));
        fabGroup.appendChild(createFAB("-", t('ui_fab_zoom_out'), () => this.zoomOut()));
        fabGroup.appendChild(createFAB("1:1", t('ui_fab_reset_zoom'), () => this.resetZoom()));
        fabGroup.appendChild(createFAB("⌖", t('ui_fab_center_view'), () => this.centerView()));

        this.container.appendChild(svg);
        this.container.appendChild(fabGroup);
        } catch (e: any) {
            console.error("drawSVG crashed", e);
            // Append whatever was generated to avoid a blank screen
            try {
                // @ts-ignore
                if (svg) this.container.appendChild(svg);
                // @ts-ignore
                if (fabGroup) this.container.appendChild(fabGroup);
            } catch (inner) {}
        }
    }

    private drawFloatingControls(group: SVGGElement, ns: string, x: number, y: number, node: SyntaxTree['nodes'][string], isLeaf: boolean = false, hasWord: boolean = false) {
        const id = node.id;
        const createBtn = (bx: number, by: number, label: string, onClick: () => void) => {
            const btnG = document.createElementNS(ns, "g") as SVGGElement;
            btnG.style.cursor = "pointer";
            btnG.style.pointerEvents = "all"; // Re-enable pointer events just for the button

            // Invisible hitbox for easy clicking
            const hitBox = document.createElementNS(ns, "rect");
            hitBox.setAttribute("x", (bx - 20).toString());
            hitBox.setAttribute("y", (by - 20).toString());
            hitBox.setAttribute("width", "40");
            hitBox.setAttribute("height", "40");
            hitBox.setAttribute("fill", "transparent");

            const text = document.createElementNS(ns, "text") as SVGTextElement;
            text.setAttribute("x", bx.toString());
            // Adjust Y slightly down so it visually centers better
            text.setAttribute("y", (by + 2).toString());
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("fill", "#d35400"); // Darker orange color
            text.setAttribute("stroke", "#d35400"); // Thicken the arrow line
            text.setAttribute("stroke-width", "2");
            text.setAttribute("font-weight", "900");
            text.setAttribute("font-size", "34px"); // Bigger arrow
            text.textContent = label;
            text.style.pointerEvents = "none";

            // Hover effect logic
            btnG.addEventListener("mouseenter", () => {
                text.setAttribute("fill", "#a04000"); // Even darker orange on hover
                text.setAttribute("stroke", "#a04000");
            });
            btnG.addEventListener("mouseleave", () => {
                text.setAttribute("fill", "#d35400");
                text.setAttribute("stroke", "#d35400");
            });

            btnG.appendChild(hitBox);
            btnG.appendChild(text);

            btnG.addEventListener("pointerdown", (e) => { e.stopPropagation(); }); // Prevent drag start
            btnG.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick();
            });

            group.appendChild(btnG);
        };

        // Up arrow (Add Parent)
        createBtn(x, y - 35, "↑", () => {
            if (this.onAddParentClick) this.onAddParentClick(id);
        });

        // Down arrow (Add Child) - Only if it doesn't have a word and is not a triangle.
        if (!hasWord && !node.isTriangle) {
            const downOffset = isLeaf ? 65 : 35;

            createBtn(x, y + downOffset, "↓", () => {
                if (this.onAddChildClick) this.onAddChildClick(id);
            });
        }

        // Delete button
        const createDeleteBtn = (bx: number, by: number, onClick: () => void) => {
            const btnG = document.createElementNS(ns, "g") as SVGGElement;
            btnG.style.cursor = "pointer";
            btnG.style.pointerEvents = "all";

            const hitBox = document.createElementNS(ns, "rect");
            hitBox.setAttribute("x", (bx - 15).toString());
            hitBox.setAttribute("y", (by - 15).toString());
            hitBox.setAttribute("width", "30");
            hitBox.setAttribute("height", "30");
            hitBox.setAttribute("fill", "transparent");

            const text = document.createElementNS(ns, "text") as SVGTextElement;
            text.setAttribute("x", bx.toString());
            text.setAttribute("y", (by + 2).toString());
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("fill", "#e74c3c"); // Red color for delete
            text.setAttribute("font-weight", "900");
            text.setAttribute("font-size", "22px");
            text.textContent = "×";
            text.style.pointerEvents = "none";

            btnG.addEventListener("mouseenter", () => { text.setAttribute("font-size", "30px"); });
            btnG.addEventListener("mouseleave", () => { text.setAttribute("font-size", "22px"); });

            btnG.appendChild(hitBox);
            btnG.appendChild(text);

            btnG.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
            btnG.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick();
            });

            group.appendChild(btnG);
        };

        const createTraceBtn = (bx: number, by: number, onClick: () => void) => {
            const btnG = document.createElementNS(ns, "g") as SVGGElement;
            btnG.style.cursor = "pointer";
            btnG.style.pointerEvents = "all";

            const hitBox = document.createElementNS(ns, "rect");
            hitBox.setAttribute("x", (bx - 15).toString());
            hitBox.setAttribute("y", (by - 15).toString());
            hitBox.setAttribute("width", "30");
            hitBox.setAttribute("height", "30");
            hitBox.setAttribute("fill", "transparent");

            const text = document.createElementNS(ns, "text") as SVGTextElement;
            text.setAttribute("x", bx.toString());
            text.setAttribute("y", (by + 2).toString());
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("fill", "#8e44ad"); // Purple for trace
            text.setAttribute("font-weight", "900");
            text.setAttribute("font-size", "22px");
            text.textContent = "t"; // t for trace
            text.style.pointerEvents = "none";

            btnG.addEventListener("mouseenter", () => { text.setAttribute("font-size", "30px"); });
            btnG.addEventListener("mouseleave", () => { text.setAttribute("font-size", "22px"); });

            btnG.appendChild(hitBox);
            btnG.appendChild(text);

            btnG.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
            btnG.addEventListener("click", (e) => {
                e.stopPropagation();
                onClick();
            });

            group.appendChild(btnG);
        };

        createDeleteBtn(x + 40, y - 10, () => {
            if (this.onDeleteClick) this.onDeleteClick(id);
        });

        if (this.allowTraces) {
            // Trace button right below delete button
            createTraceBtn(x + 40, y + 20, (e?: Event) => {
                this.isDrawingTraceOriginId = id;
                this.container.style.cursor = 'crosshair';

                // Re-render to clear buttons and show crosshair mode
                this.render(this.treeInfo!);

                // Immediately explicitly draw a small preview arrow so the user knows it started
                // even before they move the mouse/finger.
                if (this.tracePreviewPath) {
                    const pStart = this.positions[id];
                    if (pStart) {
                        const nodeOrig = this.treeInfo!.nodes[id];
                        let startY = pStart.y + 20;
                        if (nodeOrig && nodeOrig.isTriangle) {
                            startY = pStart.y + LAYOUT_CONFIG.levelHeight + 40;
                        } else if (nodeOrig && nodeOrig.childrenIds.length === 0 && nodeOrig.lexicalItem && nodeOrig.lexicalItem.trim() !== "") {
                            startY = pStart.y + 40;
                        }

                        let targetX = pStart.x + 40;
                        let targetY = startY + 40;

                        // Try to use the actual click event coordinates if available
                        if (e && (e as MouseEvent).clientX) {
                            const evt = e as MouseEvent;
                            const svg = this.container.querySelector('svg');
                            if (svg) {
                                const rect = svg.getBoundingClientRect();
                                targetX = evt.clientX - rect.left - this.panX;
                                targetY = evt.clientY - rect.top - this.panY;
                            }
                        } else if (e && (e as TouchEvent).touches && (e as TouchEvent).touches.length > 0) {
                            const evt = e as TouchEvent;
                            const svg = this.container.querySelector('svg');
                            if (svg) {
                                const rect = svg.getBoundingClientRect();
                                targetX = evt.touches[0].clientX - rect.left - this.panX;
                                targetY = evt.touches[0].clientY - rect.top - this.panY;
                            }
                        }

                        const cp1X = pStart.x;
                        const cp1Y = startY + 40;
                        const cp2X = targetX;
                        const cp2Y = Math.max(targetY + 40, startY + 40);

                        const d = `M ${pStart.x} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;
                        this.tracePreviewPath.setAttribute("d", d);
                    }
                }
            });
        } // End if (this.allowTraces)

        // Triangle toggle button (allowed for all nodes in standalone)
        if (this.allowTriangles) {
            const createTriangleBtn = (bx: number, by: number, onClick: () => void) => {
                const btnG = document.createElementNS(ns, "g") as SVGGElement;
                btnG.style.cursor = "pointer";
                btnG.style.pointerEvents = "all";

                const hitBox = document.createElementNS(ns, "rect");
                hitBox.setAttribute("x", (bx - 15).toString());
                hitBox.setAttribute("y", (by - 15).toString());
                hitBox.setAttribute("width", "30");
                hitBox.setAttribute("height", "30");
                hitBox.setAttribute("fill", "transparent");

                const text = document.createElementNS(ns, "text") as SVGTextElement;
                text.setAttribute("x", bx.toString());
                text.setAttribute("y", (by + 2).toString());
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("dominant-baseline", "middle");
                text.setAttribute("fill", node.isTriangle ? "#3498db" : "#2ecc71"); // Blue if active, Green if inactive
                text.setAttribute("font-weight", "900");
                text.setAttribute("font-size", "22px");
                text.textContent = "△";
                text.style.pointerEvents = "none";

                btnG.addEventListener("mouseenter", () => { text.setAttribute("font-size", "30px"); });
                btnG.addEventListener("mouseleave", () => { text.setAttribute("font-size", "22px"); });

                btnG.appendChild(hitBox);
                btnG.appendChild(text);

                btnG.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
                btnG.addEventListener("click", (e) => {
                    e.stopPropagation();
                    onClick();
                });

                group.appendChild(btnG);
            };

            // Position it on the left side
            createTriangleBtn(x - 40, y + 5, () => {
                if (this.onToggleTriangleClick) this.onToggleTriangleClick(id);
            });
        }
    }

    private startAutoPan() {
        if (this.autoPanRafId) return;

        const panSpeed = 6; // pixels per frame (reduced for smoother scrolling)
        const edgeThreshold = 60; // how close to the edge to trigger

        const loop = () => {
            if (!this.isDragging || !this.draggedNodeId) {
                this.stopAutoPan();
                return;
            }

            const rect = this.container.getBoundingClientRect();
            let panned = false;

            if (this.pointerClientX < rect.left + edgeThreshold) {
                this.panX += panSpeed;
                this.dragStartX += panSpeed;
                panned = true;
            } else if (this.pointerClientX > rect.right - edgeThreshold) {
                this.panX -= panSpeed;
                this.dragStartX -= panSpeed;
                panned = true;
            }

            if (this.pointerClientY < rect.top + edgeThreshold) {
                this.panY += panSpeed;
                this.dragStartY += panSpeed;
                panned = true;
            } else if (this.pointerClientY > rect.bottom - edgeThreshold) {
                this.panY -= panSpeed;
                this.dragStartY -= panSpeed;
                panned = true;
            }

            if (panned) {
                const viewport = this.container.querySelector('#viewport');
                if (viewport) {
                    viewport.setAttribute("transform", `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
                }

                // Adjust dragged node visually
                this.dragOffsetX = (this.pointerPageX - this.dragStartX) / this.zoom;
                this.dragOffsetY = (this.pointerPageY - this.dragStartY) / this.zoom;

                const nodeG = this.container.querySelector(`#node-${this.draggedNodeId}`) as SVGGElement | null;
                if (nodeG) {
                    nodeG.setAttribute("transform", `translate(${this.dragOffsetX}, ${this.dragOffsetY})`);
                }

                const linesParent = this.container.querySelectorAll(`line[data-parent="${this.draggedNodeId}"]`);
                linesParent.forEach(l => {
                    const bx = parseFloat(l.getAttribute("data-x1")!);
                    const by = parseFloat(l.getAttribute("data-y1")!);
                    l.setAttribute("x1", (bx + this.dragOffsetX).toString());
                    l.setAttribute("y1", (by + this.dragOffsetY).toString());
                });

                const linesChild = this.container.querySelectorAll(`line[data-child="${this.draggedNodeId}"]`);
                linesChild.forEach(l => {
                    const bx = parseFloat(l.getAttribute("data-x2")!);
                    const by = parseFloat(l.getAttribute("data-y2")!);
                    l.setAttribute("x2", (bx + this.dragOffsetX).toString());
                    l.setAttribute("y2", (by + this.dragOffsetY).toString());
                });

                // Clear highlights and recalculate hit targets
                const allBgRects = this.container.querySelectorAll('.bg-rect-target');
                allBgRects.forEach(rect => {
                    const isSelected = rect.getAttribute('data-isselected') === 'true';
                    const color = rect.id.includes('token') ? '#f39c12' : '#3498db';
                    rect.setAttribute('fill', isSelected ? color : 'white');
                    rect.setAttribute('opacity', isSelected ? '0.3' : '0');
                });

                const hitBox = nodeG?.querySelector('.droppable') as SVGRectElement | null;
                if (nodeG) nodeG.style.pointerEvents = 'none';
                if (hitBox) hitBox.style.pointerEvents = 'none';

                const elements = document.elementsFromPoint(this.pointerClientX, this.pointerClientY);

                if (nodeG) nodeG.style.pointerEvents = 'all';
                if (hitBox) hitBox.style.pointerEvents = 'all';

                let hitTid: string | null = null;
                for (const el of elements) {
                    if (el.classList.contains("droppable")) {
                        const tid = (el as any).dataset.droptarget;
                        if (tid && tid !== this.draggedNodeId) {
                            hitTid = tid;
                            break;
                        }
                    }
                }

                if (hitTid) {
                    const hitBg = this.container.querySelector(`#bgrect-${hitTid}`);
                    if (hitBg) {
                        hitBg.setAttribute("fill", "#e74c3c");
                        hitBg.setAttribute("opacity", "0.5");
                    }
                }
            }

            this.autoPanRafId = requestAnimationFrame(loop);
        };

        this.autoPanRafId = requestAnimationFrame(loop);
    }

    private stopAutoPan() {
        if (this.autoPanRafId) {
            cancelAnimationFrame(this.autoPanRafId);
            this.autoPanRafId = null;
        }
    }

    private clearLongPressTimer() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    private handlePointerMove(e: PointerEvent) {
        this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY });

        if (this.activePointers.size === 2) {
            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];

            const dx = p1.clientX - p2.clientX;
            const dy = p1.clientY - p2.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (this.lastPinchDistance !== null) {
                const ratio = distance / this.lastPinchDistance;
                const midX = (p1.clientX + p2.clientX) / 2;
                const midY = (p1.clientY + p2.clientY) / 2;

                this.zoomAt(midX, midY, ratio);
            }

            this.lastPinchDistance = distance;
            return;
        }

        if (this.isPanning) {
            const dx = e.clientX - this.panStartX;
            const dy = e.clientY - this.panStartY;
            this.panX = this.startPanX + dx;
            this.panY = this.startPanY + dy;

            const viewport = this.container.querySelector('#viewport');
            if (viewport) {
                viewport.setAttribute("transform", `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
            }
            return;
        }

        if (!this.isDragging || !this.draggedNodeId) return;

        const dx = e.pageX - this.dragStartX;
        const dy = e.pageY - this.dragStartY;

        // Ignore finger jitter until the pointer leaves the dead zone. Some touchscreens (often tablets)
        // fire pointermove for a stationary finger, which would otherwise cancel the long press.
        if (!this.hasMoved && Math.abs(dx) <= this.dragThreshold && Math.abs(dy) <= this.dragThreshold) return;
        this.clearLongPressTimer();

        this.pointerClientX = e.clientX;
        this.pointerClientY = e.clientY;
        this.pointerPageX = e.pageX;
        this.pointerPageY = e.pageY;

        this.startAutoPan();

        this.dragOffsetX = dx / this.zoom;
        this.dragOffsetY = dy / this.zoom;

        // Move node visually
        const nodeG = this.container.querySelector(`#node-${this.draggedNodeId}`) as SVGGElement | null;

        // Bring to front only on first move
        if (!this.hasMoved && nodeG && nodeG.parentNode) {
            nodeG.parentNode.appendChild(nodeG);
            this.hasMoved = true;

            // Hide floating UI controls during drag
            const uiGroup = this.container.querySelector("#ui-group");
            if (uiGroup) uiGroup.innerHTML = '';
        }

        if (nodeG) {
            nodeG.setAttribute("transform", `translate(${this.dragOffsetX}, ${this.dragOffsetY})`);
        }

        // Move connected lines
        const linesParent = this.container.querySelectorAll(`line[data-parent="${this.draggedNodeId}"]`);
        linesParent.forEach(l => {
            const bx = parseFloat(l.getAttribute("data-x1")!);
            const by = parseFloat(l.getAttribute("data-y1")!);
            l.setAttribute("x1", (bx + this.dragOffsetX).toString());
            l.setAttribute("y1", (by + this.dragOffsetY).toString());
        });

        const linesChild = this.container.querySelectorAll(`line[data-child="${this.draggedNodeId}"]`);
        linesChild.forEach(l => {
            const bx = parseFloat(l.getAttribute("data-x2")!);
            const by = parseFloat(l.getAttribute("data-y2")!);
            l.setAttribute("x2", (bx + this.dragOffsetX).toString());
            l.setAttribute("y2", (by + this.dragOffsetY).toString());
        });

        // Reset all drop targets
        const allBgRects = this.container.querySelectorAll('.bg-rect-target');
        allBgRects.forEach(rect => {
            const isSelected = rect.getAttribute('data-isselected') === 'true';
            const color = rect.id.includes('token') ? '#f39c12' : '#3498db'; // Determine base color based on type
            rect.setAttribute('fill', isSelected ? color : 'white');
            rect.setAttribute('opacity', isSelected ? '0.3' : '0');
        });

        // Hide dragged group pointer events to allow hit testing underneath
        const hitBox = nodeG?.querySelector('.droppable') as SVGRectElement | null;

        if (nodeG) nodeG.style.pointerEvents = 'none';
        if (hitBox) hitBox.style.pointerEvents = 'none';

        const elements = document.elementsFromPoint(e.clientX, e.clientY);

        if (nodeG) nodeG.style.pointerEvents = 'all';
        if (hitBox) hitBox.style.pointerEvents = 'all';

        let hitTid: string | null = null;
        for (const el of elements) {
            if (el.classList.contains("droppable")) {
                const tid = (el as any).dataset.droptarget;
                if (tid && tid !== this.draggedNodeId) {
                    hitTid = tid;
                    break;
                }
            }
        }

        if (hitTid) {
            const hitBg = this.container.querySelector(`#bgrect-${hitTid}`);
            if (hitBg) {
                hitBg.setAttribute("fill", "#e74c3c");
                hitBg.setAttribute("opacity", "0.5");
            }
        }

        // --- Trace Preview Update Logic ---
        if (this.isDrawingTraceOriginId && this.tracePreviewPath) {
            const pStart = this.positions[this.isDrawingTraceOriginId];
            if (pStart) {
                const nodeOrig = this.treeInfo!.nodes[this.isDrawingTraceOriginId];
                let startY = pStart.y + 20;
                if (nodeOrig && nodeOrig.isTriangle) {
                    startY = pStart.y + LAYOUT_CONFIG.levelHeight + 40;
                } else if (nodeOrig && nodeOrig.childrenIds.length === 0 && nodeOrig.lexicalItem && nodeOrig.lexicalItem.trim() !== "") {
                    startY = pStart.y + 40;
                }

                const svg = this.container.querySelector('svg');
                if (svg) {
                    const rect = svg.getBoundingClientRect();
                    const targetX = (e.clientX - rect.left - this.panX) / this.zoom;
                    const targetY = (e.clientY - rect.top - this.panY) / this.zoom;

                    const cp1X = pStart.x;
                    const cp1Y = startY + 40;
                    const cp2X = targetX;
                    const cp2Y = Math.max(targetY + 40, startY + 40);

                    const d = `M ${pStart.x} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;
                    this.tracePreviewPath.setAttribute("d", d);
                }
            }
        }
    }

    private handlePointerUp(e: PointerEvent) {
        this.activePointers.delete(e.pointerId);

        // Safety check: if activePointers size is suspiciously stuck or if no pointers are down
        if (e.buttons === 0 && this.activePointers.size > 0) {
            this.activePointers.clear();
        }

        if (this.activePointers.size < 2) {
            this.lastPinchDistance = null;
        }

        this.clearLongPressTimer();
        this.stopAutoPan();

        if (this.isPanning) {
            this.isPanning = false;
            const svg = this.container.querySelector('svg');
            if (svg) svg.style.cursor = 'grab';
            window.removeEventListener("pointermove", this.boundPointerMove);
            window.removeEventListener("pointerup", this.boundPointerUp);
            window.removeEventListener("pointercancel", this.boundPointerUp);
            return;
        }

        if (!this.isDragging) return;
        this.isDragging = false;

        window.removeEventListener("pointermove", this.boundPointerMove);
        window.removeEventListener("pointerup", this.boundPointerUp);
        window.removeEventListener("pointercancel", this.boundPointerUp);

        const nodeG = this.container.querySelector(`#node-${this.draggedNodeId}`) as SVGGElement | null;
        const hitBox = nodeG?.querySelector('.droppable') as SVGRectElement | null;

        if (nodeG) nodeG.style.pointerEvents = 'none';
        if (hitBox) hitBox.style.pointerEvents = 'none';

        const elements = document.elementsFromPoint(e.clientX, e.clientY);

        if (nodeG) nodeG.style.pointerEvents = 'all';
        if (hitBox) hitBox.style.pointerEvents = 'all';

        let dropTargetId: string | null = null;
        for (const el of elements) {
            if (el.classList.contains("droppable")) {
                dropTargetId = (el as any).dataset.droptarget;
                break;
            }
        }

        const sourceId = this.draggedNodeId;
        this.draggedNodeId = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Visual snap back and reset
        this.container.innerHTML = '';
        this.drawSVG();

        if (dropTargetId && sourceId && dropTargetId !== sourceId) {
            if (this.onNodeDrop) {
                // Determine if source was to the left or right of target
                const sourcePos = this.positions[sourceId];
                const targetPos = this.positions[dropTargetId];
                const side = (sourcePos && targetPos && sourcePos.x < targetPos.x) ? 'left' : 'right';
                
                this.onNodeDrop(sourceId, dropTargetId, side);
            }
        }
    }

    public exportImage(format: 'png' | 'svg', grayscale: boolean, hidePlaceholders: boolean = false, transparent: boolean = false) {
        if (!this.treeInfo || Object.keys(this.positions).length === 0) return;

        const originalSvg = this.container.querySelector('svg');
        if (!originalSvg) return;

        const clone = originalSvg.cloneNode(true) as SVGSVGElement;

        // Remove UI elements completely from the clone before measuring
        const uiGroup = clone.querySelector('#ui-group');
        if (uiGroup) uiGroup.remove();

        const interactiveEls = clone.querySelectorAll('.bg-rect-target, .droppable');
        interactiveEls.forEach(el => el.remove());

        // Remove selection coloring (green/orange circles)
        // In the renderer, selected nodes have '#2ecc71' or orange fill/stroke that we can reset to transparent/black,
        // or they have an opacity that we can set to 0. 
        // The background rects are already removed, but there might be a circle for selection
        const selectionCircles = clone.querySelectorAll('circle');
        selectionCircles.forEach(circle => {
            circle.setAttribute('fill', 'transparent');
            circle.setAttribute('stroke', 'transparent');
        });

        // Remove placeholder '?' markers if requested
        if (hidePlaceholders) {
            const texts = clone.querySelectorAll('text');
            texts.forEach(text => {
                if (text.textContent?.trim() === '?') {
                    text.remove();
                }
            });
        }

        // To reliably get the EXACT bounding box without math algorithms:
        // We append the cleaned clone to an offscreen div in the DOM temporarily, measure it, and remove it.
        const offscreenDiv = document.createElement('div');
        offscreenDiv.style.position = 'absolute';
        offscreenDiv.style.top = '-9999px';
        offscreenDiv.style.left = '-9999px';
        offscreenDiv.style.visibility = 'hidden';
        offscreenDiv.appendChild(clone);
        document.body.appendChild(offscreenDiv);

        // Remove panning/zooming transformations from the exported image BEFORE measuring
        const viewport = clone.querySelector('#viewport');
        if (viewport) {
            viewport.removeAttribute('transform');
        }

        let minX = 0, minY = 0, width = 0, height = 0;
        try {
            // Get the bounding box of the graphic content itself (the viewport group, because SVG element getBBox is zeroed out in Chrome)
            if (viewport) {
                const bbox = (viewport as SVGGraphicsElement).getBBox();
                minX = bbox.x;
                minY = bbox.y;
                width = bbox.width;
                height = bbox.height;
            }
        } catch (e) {
            console.error("Could not get bounding box", e);
        }

        document.body.removeChild(offscreenDiv);

        if (width === 0 || height === 0) return; // Empty or error

        // Exact 10px padding 
        const padding = 10;
        minX -= padding;
        minY -= padding;
        width += padding * 2;
        height += padding * 2;
        interactiveEls.forEach(el => el.remove());

        // Set exact viewBox to frame the tree tightly
        clone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
        clone.setAttribute('width', width.toString());
        clone.setAttribute('height', height.toString());

        // Force a web-safe sans-serif font for the exported image so it matches the UI
        // Use the user's chosen font family, falling back to system fonts
        const exportFontFamily = this._settings.fontFamily !== 'system-ui, sans-serif'
            ? `${this._settings.fontFamily}, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
            : 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
        clone.setAttribute('font-family', exportFontFamily);

        const coloredElements = clone.querySelectorAll('[fill], [stroke]');
        coloredElements.forEach(el => {
            const fill = el.getAttribute('fill');
            const stroke = el.getAttribute('stroke');

            // 1. Force main node text (white / selected blue) to black for the white export canvas
            // EXCEPTION: Placeholder '?' should stay red (#ff4444) even if selected
            if (el.tagName === 'text' && el.textContent?.trim() === '?') {
                el.setAttribute('fill', '#ff4444');
            } else {
                if (fill === 'white' || fill === '#bdc3c7' || fill === '#ecf0f1' || fill === '#3498db' || fill === '#2ecc71') {
                    el.setAttribute('fill', 'black');
                }
                if (stroke === 'white' || stroke === '#bdc3c7' || stroke === '#ecf0f1' || stroke === '#3498db' || stroke === '#2ecc71') {
                    el.setAttribute('stroke', 'black');
                }
            }

            // Reset selected leaf node word (orange) to normal unselected word color, but make it dark gray for export
            if (fill === '#f39c12') {
                el.setAttribute('fill', '#7f8c8d'); // Darker gray for readability on white
            }
            if (stroke === '#f39c12') {
                el.setAttribute('stroke', '#7f8c8d');
            }

            // Also convert normal light gray words (#ccc) to the darker gray for the export
            if (fill === '#ccc') {
                el.setAttribute('fill', '#7f8c8d');
            }
            if (stroke === '#ccc') {
                el.setAttribute('stroke', '#7f8c8d');
            }

            // Reset selected trace (lighter purple #9b59b6 + thicker width) to normal trace (#8e44ad, 2px)
            if (stroke === '#9b59b6') {
                el.setAttribute('stroke', '#8e44ad');
            }
            if (el.getAttribute('stroke-width') === '4') {
                el.setAttribute('stroke-width', '2');
            }

            // 2. If grayscale is requested, force ALL colors (except transparent/none) to black
            if (grayscale) {
                const newFill = el.getAttribute('fill');
                const newStroke = el.getAttribute('stroke');
                if (newFill && newFill !== 'transparent' && newFill !== 'none') {
                    el.setAttribute('fill', 'black');
                }
                if (newStroke && newStroke !== 'transparent' && newStroke !== 'none') {
                    el.setAttribute('stroke', 'black');
                }
            }
        });

        const svgData = new XMLSerializer().serializeToString(clone);

        if (format === 'svg') {
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `syntax_tree.svg`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'png') {
            const canvas = document.createElement('canvas');
            // For higher resolution on Retina displays, scale by 2
            const scaleFactor = 2;
            canvas.width = width * scaleFactor;
            canvas.height = height * scaleFactor;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // White background (skip if transparent)
            if (!transparent) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngData = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngData;
                a.download = `syntax_tree.png`;
                a.click();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
    }
}

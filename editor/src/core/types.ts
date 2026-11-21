/**
 * Syntax Tree Editor: shared types.
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
/**
 * Represents a unique identifier for any tree element.
 */
export type ElementId = string;

/**
 * Represents a syntactic node in the tree (e.g., S, NP, VP, N, V).
 * A node can also be a leaf node containing a lexical item.
 */
export interface TreeNode {
    id: ElementId;
    label: string; // The syntactic category (e.g., N, V, NP)
    lexicalItem?: string; // The actual word, if this is a leaf node
    childrenIds: ElementId[]; // IDs of child nodes
    parentId: ElementId | null; // ID of the parent node

    tracesTo?: { targetId: ElementId, style: 'curved' | 'orthogonal', dashed?: boolean }[]; // The traces this node originates
    isTrace?: boolean; // Is this node purely a trace marker (e.g. t_i)?
    traceIndex?: string; // e.g. 'i' for NP_i -> t_i
    isTriangle?: boolean; // Is this node represented as a triangle?
}

/**
 * The full syntax tree, containing all nodes and the original tokens.
 */
export interface SyntaxTree {
    rootId: ElementId | null;
    nodes: Record<ElementId, TreeNode>;

    // Ordered list of leaf node IDs forming the sentence
    leafSequence: ElementId[];

    // [fromId, toId]
    traces?: [ElementId, ElementId][];
}

/**
 * Helper to generate unique IDs.
 */
export function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * Creates an empty syntax tree.
 */
export function createEmptyTree(): SyntaxTree {
    return {
        rootId: null,
        nodes: {},
        leafSequence: []
    };
}

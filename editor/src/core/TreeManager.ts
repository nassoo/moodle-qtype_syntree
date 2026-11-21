/**
 * Syntax Tree Editor: tree model, history and bracket notation.
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
import { SyntaxTree, TreeNode, ElementId, generateId } from './types';

export class TreeManager {
    private tree: SyntaxTree;
    private history: string[] = [];
    private historyIndex: number = -1;

    constructor(initialTree?: SyntaxTree) {
        // Deep copy the initial tree if provided, else create empty
        this.tree = initialTree ? JSON.parse(JSON.stringify(initialTree)) : {
            rootId: null,
            nodes: {},
            leafSequence: []
        };
        this.saveState();
    }

    /**
     * Saves the current tree state to the history stack.
     */
    public saveState() {
        // Truncate future history if we're saving a new state after undoing
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const serialized = JSON.stringify(this.tree);
        // Avoid saving duplicate sequential states
        if (this.history.length === 0 || this.history[this.history.length - 1] !== serialized) {
            this.history.push(serialized);
            this.historyIndex++;
        }
    }

    public undo(): boolean {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.tree = JSON.parse(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    public redo(): boolean {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.tree = JSON.parse(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    public clearHistory() {
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
    }

    public getTree(): SyntaxTree {
        return this.tree;
    }

    public toggleTriangle(nodeId: ElementId): boolean {
        const node = this.tree.nodes[nodeId];
        if (!node) return false;
        
        node.isTriangle = !node.isTriangle;
        
        // If turning ON and it has children, capture their text into the lexicalItem for editing
        if (node.isTriangle && node.childrenIds.length > 0) {
            // Get concatenated text of ALL descendants recursively
            const text = this.getConcatenatedText(nodeId);
            node.lexicalItem = text;
        }
        
        this.rebuildLeafSequence();
        this.saveState();
        return true;
    }

    private getConcatenatedText(nodeId: ElementId): string {
        const node = this.tree.nodes[nodeId];
        if (!node) return "";
        if (node.childrenIds.length === 0) {
            return node.lexicalItem || "";
        }
        return node.childrenIds
            .map(cid => this.getConcatenatedText(cid))
            .filter(t => t.trim() !== "")
            .join(" ");
    }

    /**
     * Exports the entire tree structure (including traces) as a JSON string.
     */
    public exportToJSON(): string {
        return JSON.stringify(this.tree, null, 2);
    }

    /**
     * Imports the entire tree structure from a JSON string.
     */
    public importFromJSON(json: string): boolean {
        try {
            const data = JSON.parse(json);
            if (data && typeof data === 'object' && data.nodes) {
                this.tree = data;
                this.rebuildLeafSequence();
                this.saveState();
                return true;
            }
        } catch (e) {
            console.error("Failed to import tree from JSON", e);
        }
        return false;
    }

    /**
     * Replaces the current tree with a new parsed token sequence.
     */
    public setTokens(words: string[]) {
        this.tree = {
            rootId: null,
            nodes: {},
            leafSequence: []
        };

        words.forEach((word) => {
            const id = generateId();
            const node: TreeNode = {
                id,
                label: "", // Default label for a newly added word
                lexicalItem: word,
                childrenIds: [],
                parentId: null
            };
            this.tree.nodes[id] = node;
            this.tree.leafSequence.push(id);
        });
        
        // Important: Ensure the newly initialized state is Captured in history!
        this.saveState();
    }

    /**
     * Merges two adjacent leaf nodes into one.
     */
    public mergeTokens(id1: ElementId, id2: ElementId): boolean {
        const idx1 = this.tree.leafSequence.indexOf(id1);
        const idx2 = this.tree.leafSequence.indexOf(id2);

        if (idx1 === -1 || idx2 === -1 || Math.abs(idx1 - idx2) !== 1) {
            return false;
        }

        const first = idx1 < idx2 ? id1 : id2;
        const second = idx1 < idx2 ? id2 : id1;

        const node1 = this.tree.nodes[first];
        const node2 = this.tree.nodes[second];

        if (!node1.lexicalItem || !node2.lexicalItem) return false;

        const newId = generateId();
        const newNode: TreeNode = {
            id: newId,
            label: node1.label,
            lexicalItem: node1.lexicalItem + ' ' + node2.lexicalItem,
            childrenIds: [],
            parentId: null // Merged leaves typically lose parent connection, user has to re-attach
        };

        this.tree.nodes[newId] = newNode;

        const minIdx = Math.min(idx1, idx2);
        this.tree.leafSequence.splice(minIdx, 2, newId);

        // Disconnect from parents
        if (node1.parentId && this.tree.nodes[node1.parentId]) {
            this.tree.nodes[node1.parentId].childrenIds = this.tree.nodes[node1.parentId].childrenIds.filter(id => id !== first);
        }
        if (node2.parentId && this.tree.nodes[node2.parentId]) {
            this.tree.nodes[node2.parentId].childrenIds = this.tree.nodes[node2.parentId].childrenIds.filter(id => id !== second);
        }

        delete this.tree.nodes[first];
        delete this.tree.nodes[second];

        this.saveState();
        return true;
    }

    /**
     * Splits a leaf node into two separate leaf nodes at the specified text index.
     */
    public splitToken(id: ElementId, splitIndex: number): boolean {
        const node = this.tree.nodes[id];
        if (!node || !node.lexicalItem || splitIndex <= 0 || splitIndex >= node.lexicalItem.length) {
            return false;
        }

        const text1 = node.lexicalItem.substring(0, splitIndex).trim();
        const text2 = node.lexicalItem.substring(splitIndex).trim();

        const id1 = generateId();
        const id2 = generateId();

        this.tree.nodes[id1] = { id: id1, label: node.label, lexicalItem: text1, childrenIds: [], parentId: null };
        this.tree.nodes[id2] = { id: id2, label: node.label, lexicalItem: text2, childrenIds: [], parentId: null };

        const seqIndex = this.tree.leafSequence.indexOf(id);
        if (seqIndex !== -1) {
            this.tree.leafSequence.splice(seqIndex, 1, id1, id2);
        }

        if (node.parentId && this.tree.nodes[node.parentId]) {
            this.tree.nodes[node.parentId].childrenIds = this.tree.nodes[node.parentId].childrenIds.filter(cid => cid !== id);
        }

        delete this.tree.nodes[id];

        this.saveState();
        return true;
    }

    /**
     * Deletes a node and all its descendants.
     */
    public deleteNode(id: ElementId): boolean {
        const nodeToDelete = this.tree.nodes[id];
        if (!nodeToDelete) return false;

        // Remove from parent's children list
        if (nodeToDelete.parentId && this.tree.nodes[nodeToDelete.parentId]) {
            const parent = this.tree.nodes[nodeToDelete.parentId];
            parent.childrenIds = parent.childrenIds.filter(childId => childId !== id);
        }

        // Recursively delete descendants
        const deleteDescendants = (nodeId: ElementId) => {
            const node = this.tree.nodes[nodeId];
            if (!node) return;
            node.childrenIds.forEach(childId => deleteDescendants(childId));
            delete this.tree.nodes[nodeId];
        };
        deleteDescendants(id);

        // Update root if the deleted node was the root
        if (this.tree.rootId === id) {
            this.tree.rootId = null;
        }

        this.rebuildLeafSequence();

        // Option 2: Automatic respawn - If the tree is completely empty, spawn a new 'root'
        if (Object.keys(this.tree.nodes).length === 0) {
            const newRootId = this.addNode("root");
            this.tree.rootId = newRootId;
            this.tree.leafSequence = [newRootId];
        }

        this.saveState();
        return true;
    }

    /**
     * Adds a new syntactic node to the tree.
     */
    public addNode(label: string, childrenIds: ElementId[] = []): ElementId {
        const id = generateId();
        const node: TreeNode = {
            id,
            label,
            childrenIds: [...childrenIds],
            parentId: null
        };

        this.tree.nodes[id] = node;

        // Update parent references for children
        childrenIds.forEach(childId => {
            if (this.tree.nodes[childId]) {
                const childNode = this.tree.nodes[childId];
                if (childNode.parentId && this.tree.nodes[childNode.parentId]) {
                    // Remove from old parent
                    const oldParent = this.tree.nodes[childNode.parentId];
                    oldParent.childrenIds = oldParent.childrenIds.filter(cid => cid !== childId);
                }
                childNode.parentId = id;
            }
        });

        // Heuristic: If we don't have a root or if the newly added node adopts the old root, make this the new root
        if (!this.tree.rootId || childrenIds.includes(this.tree.rootId)) {
            this.tree.rootId = id;
        }

        return id;
    }

    /**
     * Specialized method to add a new parent node above an existing node.
     * This avoids the "shifting indices" bug when using addNode.
     */
    public addParent(childId: ElementId, label: string = ""): ElementId {
        const childNode = this.tree.nodes[childId];
        if (!childNode) return "";

        const oldParentId = childNode.parentId;
        const newId = generateId();

        const newNode: TreeNode = {
            id: newId,
            label,
            childrenIds: [childId],
            parentId: oldParentId
        };
        this.tree.nodes[newId] = newNode;

        // Update child's parent
        childNode.parentId = newId;

        if (oldParentId && this.tree.nodes[oldParentId]) {
            const oldParent = this.tree.nodes[oldParentId];
            const idx = oldParent.childrenIds.indexOf(childId);
            if (idx !== -1) {
                // Replace the child with the new parent in the same position
                oldParent.childrenIds[idx] = newId;
            }
        } else if (this.tree.rootId === childId) {
            this.tree.rootId = newId;
        }

        this.rebuildLeafSequence();
        this.saveState();
        return newId;
    }

    /**
     * Sets the children of a given node, re-parenting them as necessary.
     */
    public setChildren(parentId: ElementId, newChildrenIds: ElementId[]): boolean {
        const parent = this.tree.nodes[parentId];
        if (!parent) return false;

        // Disconnect old children
        parent.childrenIds.forEach(oldChildId => {
            const oldChild = this.tree.nodes[oldChildId];
            if (oldChild && oldChild.parentId === parentId) {
                oldChild.parentId = null;
            }
        });

        // Connect new children
        newChildrenIds.forEach(childId => {
            const child = this.tree.nodes[childId];
            if (child) {
                // Remove from old parent if it had one
                if (child.parentId && this.tree.nodes[child.parentId]) {
                    const oldParent = this.tree.nodes[child.parentId];
                    oldParent.childrenIds = oldParent.childrenIds.filter(cid => cid !== childId);
                }
                child.parentId = parentId;
            }
        });

        parent.childrenIds = newChildrenIds;

        this.rebuildLeafSequence();
        this.saveState();
        return true;
    }

    /**
     * Removes a node from its parent, making it a root or floating node.
     */
    public unparent(id: ElementId): boolean {
        const node = this.tree.nodes[id];
        if (!node || !node.parentId) return false;

        const parent = this.tree.nodes[node.parentId];
        if (parent) {
            parent.childrenIds = parent.childrenIds.filter(childId => childId !== id);
        }
        node.parentId = null;

        this.rebuildLeafSequence();
        this.saveState();
        return true;
    }

    /**
     * Completely rebuilds the visual leafSequence array automatically strictly via DFS structural traversal
     * of the tree graph. This guarantees mathematically that branches NEVER cross structurally!
     */
    public rebuildLeafSequence() {
        const newSeq: ElementId[] = [];
        const visited = new Set<ElementId>();

        const traverse = (nodeId: ElementId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            const node = this.tree.nodes[nodeId];
            if (!node) return;

            if (node.childrenIds.length === 0 || node.isTriangle) {
                newSeq.push(nodeId);
            } else {
                node.childrenIds.forEach(traverse);
            }
        };

        const getRootOf = (id: ElementId): ElementId => {
            let curr = id;
            while (this.tree.nodes[curr] && this.tree.nodes[curr].parentId) {
                curr = this.tree.nodes[curr].parentId!;
            }
            return curr;
        };

        // Go through the existing leafSequence to preserve broad relative order of disconnected floating trees
        for (const leafId of this.tree.leafSequence) {
            if (visited.has(leafId)) continue;
            const subtreeRoot = getRootOf(leafId);
            traverse(subtreeRoot);
        }

        // Catch any stray leaves
        Object.keys(this.tree.nodes).forEach(id => {
            const node = this.tree.nodes[id];
            if (node && node.childrenIds.length === 0 && !visited.has(id)) {
                newSeq.push(id);
            }
        });

        this.tree.leafSequence = newSeq;
    }

    /**
     * Recursively extracts all leaf node IDs (words) that belong to the given node's subtree.
     */
    public getTokensForNode(nodeId: ElementId): ElementId[] {
        const node = this.tree.nodes[nodeId];
        if (!node) return [];

        if (node.childrenIds.length === 0 || node.isTriangle) {
            return [nodeId];
        }

        let words: ElementId[] = [];
        for (const childId of node.childrenIds) {
            words = words.concat(this.getTokensForNode(childId));
        }
        return words;
    }

    /**
     * Checks if node A is an ancestor of node B.
     */
    public isAncestor(ancestorId: ElementId, descendantId: ElementId): boolean {
        let currentId: ElementId | null = descendantId;
        while (currentId) {
            if (currentId === ancestorId) return true;
            const node: TreeNode | undefined = this.tree.nodes[currentId];
            if (!node) break;
            currentId = node.parentId;
        }
        return false;
    }

    /**
     * Makes childId a child of parentId.
     */
    public makeChild(parentId: ElementId, childId: ElementId, side: 'left' | 'right' = 'right'): boolean {
        const parent = this.tree.nodes[parentId];
        const child = this.tree.nodes[childId];

        if (!parent || !child) return false;

        // Prevent cycles
        if (this.isAncestor(childId, parentId)) return false;

        // Remove child from its old parent
        if (child.parentId && this.tree.nodes[child.parentId]) {
            const oldParent = this.tree.nodes[child.parentId];
            oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== childId);
        }

        // Add to new parent at the specified side
        if (side === 'left') {
            parent.childrenIds.unshift(childId);
        } else {
            parent.childrenIds.push(childId);
        }
        child.parentId = parentId;

        // If the child was the root, the parent is now the root (if parent has no parent)
        if (this.tree.rootId === childId && !parent.parentId) {
            this.tree.rootId = parentId;
        }

        this.rebuildLeafSequence(); // Resync visual order to prevent overlaps
        this.saveState(); // Commit change to history
        return true;
    }

    /**
     * Swaps the positions (parents and indices) of two nodes.
     * Keeps their own children intact.
     */
    public swapNodes(id1: ElementId, id2: ElementId): boolean {
        const node1 = this.tree.nodes[id1];
        const node2 = this.tree.nodes[id2];

        if (!node1 || !node2) return false;

        // Prevent swapping if one is an ancestor of the other (too complex structurally)
        if (this.isAncestor(id1, id2) || this.isAncestor(id2, id1)) return false;

        const parent1Id = node1.parentId;
        const parent2Id = node2.parentId;

        // Same parent case (just swap order in the children array)
        if (parent1Id === parent2Id && parent1Id && this.tree.nodes[parent1Id]) {
            const p = this.tree.nodes[parent1Id];
            const idx1 = p.childrenIds.indexOf(id1);
            const idx2 = p.childrenIds.indexOf(id2);
            if (idx1 !== -1 && idx2 !== -1) {
                p.childrenIds[idx1] = id2;
                p.childrenIds[idx2] = id1;
            }
        } else {
            // Different parents case
            if (parent1Id && this.tree.nodes[parent1Id]) {
                const p1 = this.tree.nodes[parent1Id];
                const idx1 = p1.childrenIds.indexOf(id1);
                if (idx1 !== -1) p1.childrenIds[idx1] = id2;
            }

            if (parent2Id && this.tree.nodes[parent2Id]) {
                const p2 = this.tree.nodes[parent2Id];
                const idx2 = p2.childrenIds.indexOf(id2);
                if (idx2 !== -1) p2.childrenIds[idx2] = id1;
            }

            // Update parent references
            node1.parentId = parent2Id;
            node2.parentId = parent1Id;
        }

        // Handle root cases (if one of them was root, the other becomes root)
        if (this.tree.rootId === id1) {
            this.tree.rootId = id2;
        } else if (this.tree.rootId === id2) {
            this.tree.rootId = id1;
        }

        // Guarantee perfect, crossing-free visual ordering directly from the new structural morphology!
        this.rebuildLeafSequence();
        this.saveState(); // Commit change to history
        return true;
    }

    /**
     * Adds a trace link from one node to another.
     * Traces are stored as an array of [fromId, toId] tuples.
     */
    public addTrace(fromId: ElementId, toId: ElementId): boolean {
        const fromNode = this.tree.nodes[fromId];
        const toNode = this.tree.nodes[toId];

        if (!fromNode || !toNode) return false;

        if (!this.tree.traces) {
            this.tree.traces = [];
        }

        // Prevent duplicate traces
        if (this.tree.traces.some(trace => trace[0] === fromId && trace[1] === toId)) {
            return false;
        }

        this.tree.traces.push([fromId, toId]);
        this.saveState();
        return true;
    }

    /**
     * Removes a trace link between two nodes.
     */
    public removeTrace(fromId: ElementId, toId: ElementId): boolean {
        if (!this.tree.traces) return false;

        const initialLength = this.tree.traces.length;
        this.tree.traces = this.tree.traces.filter(trace => !(trace[0] === fromId && trace[1] === toId));

        if (this.tree.traces.length < initialLength) {
            this.saveState();
            return true;
        }
        return false;
    }

    /**
     * Exports the main tree to a bracket notation string.
     * Example: [S [NP [D The] [N dog]] [VP [V barked]]]
     */
    public exportToBracketNotation(): string {
        const roots = Object.keys(this.tree.nodes).filter(k => !this.tree.nodes[k].parentId);

        if (roots.length === 0) return "";

        // Check if the tree has any real content (not just placeholders)
        const hasRealContent = Object.values(this.tree.nodes).some(node => {
            const hasLabel = node.label && node.label.trim() !== '' && node.label.trim() !== '?';
            const hasLex = node.lexicalItem && node.lexicalItem.trim() !== '' && node.lexicalItem.trim() !== '?';
            return hasLabel || hasLex;
        });
        if (!hasRealContent) return "";

        if (roots.length === 1) {
            return this.buildBracketString(roots[0]);
        }

        // --- SORT ROOTS BY SENTENCE ORDER ---
        // Find the index of the first leaf (word) for each root in the leafSequence
        const sortedRoots = roots.map(rootId => {
            const leafIds = this.getTokensForNode(rootId);
            // Find the minimum index in leafSequence for all leaves in this subtree
            const minIdx = Math.min(...leafIds.map(lid => this.tree.leafSequence.indexOf(lid)));
            return { id: rootId, idx: minIdx };
        }).sort((a, b) => a.idx - b.idx);

        // Export them in the correct sentence order
        return sortedRoots.map(r => this.buildBracketString(r.id)).join(" ");
    }

    private buildBracketString(nodeId: string): string {
        const node = this.tree.nodes[nodeId];
        if (!node) return "";

        // Spaces and brackets inside a label would split it into separate tokens
        const label = (node.label || "").replace(/[\s\[\]]+/g, "");

        if (node.childrenIds.length === 0) {
            // Leaf node. An empty label is written as "?" so the word is not read back as the label.
            const lex = node.lexicalItem || "";
            return `[${label || "?"} ${lex}]`;
        }

        const childrenStrs = node.childrenIds.map(cid => this.buildBracketString(cid)).join(" ");
        return `[${label} ${childrenStrs}]`;
    }

    /**
     * Imports a tree from bracket notation.
     */
    public importFromBracketNotation(bracketStr: string): boolean {
        const text = bracketStr.trim();
        if (!text) return false;

        // Reset the tree
        this.tree = {
            rootId: null,
            nodes: {},
            leafSequence: []
        };

        try {
            let pos = 0;
            const roots: string[] = [];

            const parseNode = (parentIdx: string | null): string => {
                while (pos < text.length && /\s/.test(text[pos])) pos++;

                if (pos >= text.length || text[pos] !== '[') throw new Error("Expected '['");
                pos++; // skip '['

                while (pos < text.length && /\s/.test(text[pos])) pos++;
                let label = "";
                while (pos < text.length && text[pos] !== '[' && text[pos] !== ']' && !/\s/.test(text[pos])) {
                    label += text[pos];
                    pos++;
                }

                const nodeId = generateId();
                const node: TreeNode = {
                    id: nodeId,
                    label: label === "?" ? "" : label, // "?" is the placeholder for an empty label
                    childrenIds: [],
                    parentId: parentIdx
                };

                this.tree.nodes[nodeId] = node;

                let hasChildrenNodes = false;
                let lexicalContent = "";

                while (pos < text.length) {
                    while (pos < text.length && /\s/.test(text[pos])) pos++; // skip spaces

                    if (text[pos] === ']') {
                        pos++; // end of node
                        break;
                    }

                    if (text[pos] === '[') {
                        hasChildrenNodes = true;
                        const childId = parseNode(nodeId);
                        node.childrenIds.push(childId);
                    } else {
                        // read text until ']' or '['
                        let str = "";
                        while (pos < text.length && text[pos] !== '[' && text[pos] !== ']') {
                            str += text[pos];
                            pos++;
                        }
                        lexicalContent += str.trim();
                    }
                }

                if (!hasChildrenNodes) {
                    node.lexicalItem = lexicalContent || "";
                }

                return nodeId;
            };

            while (pos < text.length) {
                while (pos < text.length && /\s/.test(text[pos])) pos++;
                if (pos >= text.length) break;

                if (text[pos] === '[') {
                    roots.push(parseNode(null));
                } else {
                    pos++;
                }
            }

            if (roots.length > 0) {
                this.tree.rootId = roots[0];
                // Build leafSequence by traversing all roots in order
                const newSeq: string[] = [];
                const collectLeaves = (nid: string) => {
                    const n = this.tree.nodes[nid];
                    if (n.childrenIds.length === 0) {
                        newSeq.push(nid);
                    } else {
                        n.childrenIds.forEach(collectLeaves);
                    }
                };
                roots.forEach(collectLeaves);
                this.tree.leafSequence = newSeq;
                
                // Commit the imported state to history
                this.saveState();
            }

            return true;
        } catch (e) {
            console.error("Failed to parse bracket notation:", e);
            return false;
        }
    }
}

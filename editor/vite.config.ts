/**
 * Syntax Tree Editor: build of the Moodle editor bundle.
 *
 * Copyright (C) 2026 Atanas Atanasov
 * Licensed under the GNU GPL v3 or later, with additional terms under section 7 (see NOTICE).
 */
import { defineConfig } from 'vite';

// Writes syntree.bundle.js and the guides (from public/) to ../vue_app/dist, where the plugin loads them.
export default defineConfig({
    build: {
        outDir: '../vue_app/dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'src/main-moodle.ts',
            output: {
                // Immediately Invoked Function Expression - good for browsers/Moodle
                format: 'iife',
                entryFileNames: 'syntree.bundle.js',
                assetFileNames: 'syntree.styles.[ext]',
                // "/*!" marks a legal comment, which minification keeps
                banner: '/*! Syntax Tree Editor for Moodle (qtype_syntree) | (C) 2026 Atanas Atanasov | GPL-3.0-or-later with additional terms, see NOTICE | https://github.com/nassoo/moodle-qtype_syntree */',
            }
        }
    }
});

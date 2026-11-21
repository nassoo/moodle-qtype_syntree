// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Loads the syntax tree editor bundle into a question and starts it.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @module     qtype_syntree/editor_core
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jquery'], function($) {
    return {
        init: function(params) {
            var container = document.getElementById(params.containerId);
            if (!container) {
                console.error("Syntree container not found", params.containerId);
                return;
            }

            var showMessage = function(text, isError) {
                var div = document.createElement('div');
                div.style.padding = '20px';
                if (isError) {
                    div.style.color = 'red';
                }
                div.textContent = text;
                container.innerHTML = '';
                container.appendChild(div);
            };

            showMessage(M.util.get_string('loader_loading', 'qtype_syntree'), false);

            var hiddenInput = document.getElementById(params.inputId);
            var initialData = params.initialData;
            // For teacher, prioritize the input field's current value
            if (hiddenInput && params.mode === 'teacher' && hiddenInput.value) {
                initialData = hiddenInput.value;
            }

            var scriptId = 'syntree-bundle-script';
            if (!document.getElementById(scriptId)) {
                var s = document.createElement('script');
                s.id = scriptId;
                s.src = params.bundleUrl;
                s.type = 'text/javascript';
                s.onload = function() {
                    var checks = 0;
                    var checkInterval = setInterval(function() {
                        if (typeof window.initSyntaxTreeEditor === 'function') {
                            clearInterval(checkInterval);
                            params.initialData = initialData;
                            window.initSyntaxTreeEditor(params);
                        } else {
                            checks++;
                            if (checks > 50) { // Give up after 5 seconds
                                clearInterval(checkInterval);
                                console.error("Syntree script loaded but window.initSyntaxTreeEditor is missing!");
                                showMessage(M.util.get_string('loader_error_init_missing', 'qtype_syntree'), true);
                            }
                        }
                    }, 100);
                };
                s.onerror = function() {
                    showMessage(M.util.get_string('loader_error_script_load', 'qtype_syntree', params.bundleUrl), true);
                };
                document.head.appendChild(s);
            } else {
                // Another question on this page is already loading the bundle; wait for it, but not forever.
                var waits = 0;
                var waitInterval = setInterval(function() {
                    if (window.initSyntaxTreeEditor) {
                        clearInterval(waitInterval);
                        params.initialData = initialData;
                        window.initSyntaxTreeEditor(params);
                    } else if (++waits > 100) { // Give up after 10 seconds
                        clearInterval(waitInterval);
                        showMessage(M.util.get_string('loader_error_load_failed', 'qtype_syntree'), true);
                    }
                }, 100);
            }
        }
    };
});

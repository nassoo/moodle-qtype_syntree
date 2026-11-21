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
 * Behaviour of the question edit form: guide button, functions weight, first error.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @module     qtype_syntree/edit_form
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    return {
        init: function() {
            // Open the guide of the teacher editor
            var guideButton = document.getElementById('syntree-open-guide');
            if (guideButton) {
                guideButton.addEventListener('click', function() {
                    if (typeof window.openSyntreeHelp === 'function') {
                        window.openSyntreeHelp('syntree-teacher-editor');
                    }
                });
            }

            // Show the functions weight as 100 minus the tree weight
            var treeInput = document.getElementById('id_treeweight');
            var funcDisplay = document.getElementById('id_functionsweight_val');
            if (treeInput && funcDisplay) {
                var update = function() {
                    var val = parseInt(treeInput.value, 10);
                    if (isNaN(val)) {
                        val = 0;
                    }
                    val = Math.max(0, Math.min(100, val));
                    funcDisplay.textContent = String(100 - val);
                };
                treeInput.addEventListener('input', update);
                treeInput.addEventListener('change', update);
                update();
            }

            // Scroll to first validation error if present
            var errEl = document.querySelector('.error, .moodle-has-error, .form-control-feedback');
            if (errEl) {
                setTimeout(function() {
                    errEl.scrollIntoView({behavior: 'smooth', block: 'center'});
                }, 300);
            }
        }
    };
});

<?php
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
 * English language strings for the Syntax Tree question type.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'Syntax Tree';
$string['pluginname_help'] = 'A question type that allows students to build syntax trees using visual drag and drop, which is then validated against a bracket notation.

Syntax Tree Editor by Atanas Atanasov (https://syntree.ezik.bg).';
$string['pluginname_link'] = 'question/type/syntree';
$string['pluginnameadding'] = 'Adding a Syntax Tree question';
$string['pluginnameediting'] = 'Editing a Syntax Tree question';
$string['pluginnamesummary'] = 'Students build a syntax tree representing the syntactic structure of a sentence.';

$string['answer_bracket_notation'] = 'Correct bracket notation';
$string['answer_bracket_notation_help'] = 'The correct syntax tree represented in bracket notation. Example: [S [NP The cat] [VP sleeps.]]';
$string['allowtraces'] = 'Allow Traces';
$string['allowtraces_help'] = 'If enabled, the "Trace" button will be available in the editor, allowing the drawing of movement traces between nodes.';
$string['allowimport'] = 'Allow Bracket Import';
$string['allowimport_help'] = 'If enabled, students will have an option to import an existing bracket notation string into the editor.';

$string['showfunctions'] = 'Show syntactic functions list';
$string['showfunctions_help'] = 'If enabled, a table will be shown above the tree where students must enter the syntactic function for specific phrases.';
$string['functionslist'] = 'Functions Configuration';
$string['functionslist_help'] = "Format: Phrase | Label=100; Alias=50\nExample:\nthe dog | subject=100\nsaw | predicate=100\na cat | direct object=100; object=50";
$string['teacher_instructions'] = 'Draw the reference tree below. Tip: Use "|" to allow alternative labels for a node (e.g., "S|IP").';
$string['treeweight'] = 'Tree Structure Weight';
$string['functions_weight'] = 'Functions Weight';
$string['treeweight_help'] = 'The percentage of the total grade that comes from the correct structure of the tree. The rest will come from the functions list.';
$string['pleasedrawtree'] = 'Please draw the correct syntax tree.';
$string['invalidtree'] = 'The syntax tree looks invalid. Please ensure you have drawn at least one node.';
$string['grading_details'] = 'Grading Details';
$string['tree_score'] = 'Tree Structure Score';
$string['functions_score'] = 'Syntactic Functions Score';
$string['phrase'] = 'Phrase';
$string['expected_function'] = 'Expected Function';
$string['student_answer'] = 'Your Answer';
$string['score'] = 'Score';
$string['posweight'] = 'POS Accuracy Weight';
$string['posweight_help'] = 'The percentage of the tree grade that comes from correct part-of-speech (leaf nodes) tagging.';
$string['rootweight'] = 'Root Identification Weight';
$string['rootweight_help'] = 'The percentage of the tree grade that comes from correctly identifying the root node label.';
$string['hierarchyweight'] = 'Internal Hierarchy Weight';
$string['hierarchyweight_help'] = 'The percentage of the tree grade that comes from the correct internal hierarchical structure of the tree.';
$string['weights_must_sum_100'] = 'The POS, Root, and Hierarchy weights must sum exactly to 100.';
$string['weight_range'] = 'The weight must be between 0 and 100.';
$string['casesensitive'] = 'Case-sensitive labels';
$string['casesensitive_help'] = 'If enabled, node labels must match the reference in upper and lower case (e.g. vP and VP count as different labels). Syntactic functions are always compared case-insensitively.';
$string['pleaseenteryouranswer'] = 'Please build the syntax tree before submitting.';
$string['phrase_word'] = 'Phrase / Word';
$string['syntactic_function'] = 'Syntactic Function';
$string['pos_score'] = 'POS Score ({$a}%)';
$string['root_score'] = 'Root Score ({$a}%)';
$string['hierarchy_score'] = 'Hierarchy Score ({$a}%)';
$string['paths_comparison'] = 'View detailed structural paths comparison';
$string['privacy:metadata'] = 'The Syntax Tree question type does not store any personal data itself. Student answers are stored by the Moodle question engine.';

$string['form_quickhelp_title'] = 'Syntax Tree Editor Help & Instructions';
$string['form_quickhelp_desc'] = 'View comprehensive documentation, visual examples, and keyboard shortcuts.';
$string['form_open_guide'] = 'Open Guide';

$string['loader_loading'] = 'Loading Visual Editor Component...';
$string['loader_error_init_missing'] = 'Error: Script file loaded, but the initializing function was not found inside it.';
$string['loader_error_script_load'] = 'Error: Failed to load Syntree script from {$a}';
$string['loader_error_load_failed'] = 'Error: Failed to load the syntax tree editor.';

$string['ui_import_bracket_placeholder'] = 'Import Bracket Notation...';
$string['ui_copy_title'] = 'Copy to clipboard';
$string['ui_copy'] = 'Copy';
$string['ui_copied'] = 'Copied!';
$string['ui_clear_input_title'] = 'Clear input';
$string['ui_import_bracket'] = 'Import Bracket';
$string['ui_export_bracket'] = 'Export Bracket';
$string['ui_clear_screen'] = 'Clear Screen';
$string['ui_help'] = '? Help';
$string['ui_toggle_toolbars'] = 'Toggle Toolbars (Hide/Show)';
$string['ui_modal_dnd_title'] = 'Node Action';
$string['ui_modal_dnd_question'] = 'What should happen with the dragged node {$a->source} and the target {$a->target}?';
$string['ui_dnd_child1_default'] = '↳ 1 becomes child of 2';
$string['ui_dnd_child2_default'] = '↳ 2 becomes child of 1';
$string['ui_dnd_child1'] = '↳ {$a->source} (dragged node) becomes child of {$a->target} (target)';
$string['ui_dnd_child2'] = '↳ {$a->target} (target) becomes child of {$a->source} (dragged node)';
$string['ui_dnd_swap'] = '⇄ Swap nodes';
$string['ui_cancel'] = 'Cancel';
$string['ui_modal_delete_title'] = 'Delete Node';
$string['ui_modal_delete_question'] = 'Node \'{$a}\' has children. How to proceed?';
$string['ui_delete_keep'] = 'Delete node, keep children';
$string['ui_delete_cascade'] = 'Delete node AND all children';
$string['ui_modal_help_title'] = 'Help & Instructions';
$string['ui_close'] = 'Close';
$string['ui_loading_instructions'] = 'Loading instructions...';
$string['ui_guide_load_error'] = 'Error: Could not load instructions. Please check your connection.';
$string['ui_disconnected_warning'] = '⚠️ Warning: The tree is not fully connected — some nodes are isolated!';
$string['ui_invalid_bracket'] = 'Invalid bracket notation structure.';
$string['ui_node_label_placeholder'] = 'Label';
$string['ui_node_phrase_placeholder'] = 'Phrase';
$string['ui_node_word_placeholder'] = 'Word';
$string['ui_fab_undo'] = 'Undo (Ctrl+Z)';
$string['ui_fab_redo'] = 'Redo (Ctrl+Y)';
$string['ui_fab_zoom_in'] = 'Zoom In (Ctrl + + / Ctrl + Scroll)';
$string['ui_fab_zoom_out'] = 'Zoom Out (Ctrl + - / Ctrl + Scroll)';
$string['ui_fab_reset_zoom'] = 'Reset Zoom (Ctrl + 0)';
$string['ui_fab_center_view'] = 'Center View (Double-click background)';

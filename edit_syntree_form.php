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
 * Defines the editing form for the Syntax Tree question type.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/question/type/edit_question_form.php');

/**
 * Editing form for the Syntax Tree question type.
 */
class qtype_syntree_edit_form extends question_edit_form {

    protected function definition_inner($mform) {
        global $PAGE;

        // Quick help guide button at the very beginning of the form
        $quickhelp_html = '
        <div class="syntree-quickhelp-container" style="background: #fdfdfd; border: 1px solid #ced4da; border-radius: 8px; padding: 15px; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 5px solid #607D8B;">
            <div>
                <h5 style="margin: 0; color: #455a64; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">📖</span> ' . s(get_string('form_quickhelp_title', 'qtype_syntree')) . '
                </h5>
                <p style="margin: 5px 0 0; color: #607D8B; font-size: 0.95rem;">' . s(get_string('form_quickhelp_desc', 'qtype_syntree')) . '</p>
            </div>
            <button type="button" id="syntree-open-guide" class="btn btn-secondary" style="font-weight: bold; padding: 8px 16px; border-radius: 6px;">
                ' . s(get_string('form_open_guide', 'qtype_syntree')) . '
            </button>
        </div>';
        $mform->addElement('html', $quickhelp_html);

        $mform->addElement('header', 'answerhdr', get_string('answer', 'question'));
        $mform->setExpanded('answerhdr');

        // Traces are not saved in the answer and not graded yet, so the option stays hidden until they are.

        $mform->addElement('advcheckbox', 'allowimport', get_string('allowimport', 'qtype_syntree'), get_string('allowimport_help', 'qtype_syntree'));
        $mform->setDefault('allowimport', 0);

        $mform->addElement('advcheckbox', 'casesensitive', get_string('casesensitive', 'qtype_syntree'), get_string('casesensitive_help', 'qtype_syntree'));
        $mform->setDefault('casesensitive', 0);

        $mform->addElement('advcheckbox', 'showfunctions', get_string('showfunctions', 'qtype_syntree'), get_string('showfunctions_help', 'qtype_syntree'));
        $mform->setDefault('showfunctions', 0);

        $mform->addElement('text', 'treeweight', get_string('treeweight', 'qtype_syntree'), array('size' => 3));
        $mform->setType('treeweight', PARAM_INT);
        $mform->setDefault('treeweight', 70);

        // Read-only display of the remaining weight; the edit_form AMD module keeps it in sync with treeweight.
        $treeweight = isset($this->question->options->treeweight) ? (int)$this->question->options->treeweight : 70;
        $mform->addElement('static', 'functionsweight_display', get_string('functions_weight', 'qtype_syntree'),
            html_writer::span((string)(100 - $treeweight), '', ['id' => 'id_functionsweight_val', 'style' => 'font-weight: bold;']) . ' %');

        $mform->addElement('textarea', 'functionslist', get_string('functionslist', 'qtype_syntree'), [
            'rows' => 5,
            'style' => 'width:100%',
            'placeholder' => get_string('functionslist_help', 'qtype_syntree')
        ]);
        $mform->setType('functionslist', PARAM_RAW);
        $mform->addHelpButton('functionslist', 'functionslist', 'qtype_syntree');
        $mform->disabledIf('functionslist', 'showfunctions', 'notchecked');

        $mform->addElement('text', 'posweight', get_string('posweight', 'qtype_syntree'), array('size' => 3));
        $mform->setType('posweight', PARAM_INT);
        $mform->setDefault('posweight', 15);
        $mform->addHelpButton('posweight', 'posweight', 'qtype_syntree');

        $mform->addElement('text', 'rootweight', get_string('rootweight', 'qtype_syntree'), array('size' => 3));
        $mform->setType('rootweight', PARAM_INT);
        $mform->setDefault('rootweight', 5);
        $mform->addHelpButton('rootweight', 'rootweight', 'qtype_syntree');

        $mform->addElement('text', 'hierarchyweight', get_string('hierarchyweight', 'qtype_syntree'), array('size' => 3));
        $mform->setType('hierarchyweight', PARAM_INT);
        $mform->setDefault('hierarchyweight', 80);
        $mform->addHelpButton('hierarchyweight', 'hierarchyweight', 'qtype_syntree');

        // Use a textarea instead of a hidden field so Moodle's QuickForm can properly attach validation errors to it.
        // We hide it via CSS, but QuickForm still treats it as a field that can have an error.
        $mform->addElement('textarea', 'answer_bracket_notation', '', ['rows' => 3, 'style' => 'width:100%; display:none;', 'id' => 'id_answer_bracket_notation']);
        $mform->setType('answer_bracket_notation', PARAM_RAW);

        // Container for editor
        $allowimport = isset($this->question->options->allowimport) ? (bool)$this->question->options->allowimport : true;
        $editor_html = '<p style="margin-bottom:10px; color:#555;"><i>' . get_string('teacher_instructions', 'qtype_syntree') . '</i></p>';
        $editor_html .= html_writer::div('', '', [
            'id' => 'syntree-teacher-editor',
            'data-mode' => 'teacher',
            'data-allowimport' => (int)$allowimport,
            'data-allowtraces' => 0,
            'style' => 'width:100%; min-height:600px; border:1px solid #ccc; background:#f4f6f8; position:relative;',
        ]);
        $mform->addElement('html', $editor_html);

        $PAGE->requires->strings_for_js(qtype_syntree::JS_STRINGS, 'qtype_syntree');
        $PAGE->requires->js_call_amd('qtype_syntree/editor_core', 'init', [[
            'bundleUrl'   => qtype_syntree::get_bundle_url(),
            'containerId' => 'syntree-teacher-editor',
            'inputId'     => 'id_answer_bracket_notation',
            'mode'        => 'teacher',
            'initialData' => '',
            'readonly'    => false,
            'allowtraces' => false,
            'allowimport' => $allowimport
        ]]);

        // Help button, live functions weight and scrolling to the first validation error
        $PAGE->requires->js_call_amd('qtype_syntree/edit_form', 'init');
    }

    public function validation($data, $files) {
        $errors = parent::validation($data, $files);

        // Add custom validation for the syntax tree answer
        $bracket = trim($data['answer_bracket_notation']);
        if (empty($bracket)) {
            $errors['answer_bracket_notation'] = get_string('pleasedrawtree', 'qtype_syntree');
        } else if (!preg_match('/^\[/', $bracket)) {
            $errors['answer_bracket_notation'] = get_string('invalidtree', 'qtype_syntree');
        } else {
            // Reject placeholder-only trees like "[? ?]" - strip brackets, question marks, whitespace
            $stripped = preg_replace('/[\[\]\?\s]/', '', $bracket);
            if ($stripped === '') {
                $errors['answer_bracket_notation'] = get_string('pleasedrawtree', 'qtype_syntree');
            }
        }

        $inrange = function($value) {
            return $value >= 0 && $value <= 100;
        };

        $tree = isset($data['treeweight']) ? (int)$data['treeweight'] : 70;
        if (!$inrange($tree)) {
            $errors['treeweight'] = get_string('weight_range', 'qtype_syntree');
        }

        $pos = isset($data['posweight']) ? (int)$data['posweight'] : 0;
        $root = isset($data['rootweight']) ? (int)$data['rootweight'] : 0;
        $hier = isset($data['hierarchyweight']) ? (int)$data['hierarchyweight'] : 0;
        if (!$inrange($pos) || !$inrange($root) || !$inrange($hier)) {
            foreach (['posweight' => $pos, 'rootweight' => $root, 'hierarchyweight' => $hier] as $field => $value) {
                if (!$inrange($value)) {
                    $errors[$field] = get_string('weight_range', 'qtype_syntree');
                }
            }
        } else if (($pos + $root + $hier) !== 100) {
            $errors['posweight'] = get_string('weights_must_sum_100', 'qtype_syntree');
            $errors['rootweight'] = get_string('weights_must_sum_100', 'qtype_syntree');
            $errors['hierarchyweight'] = get_string('weights_must_sum_100', 'qtype_syntree');
        }

        return $errors;
    }

    protected function data_preprocessing($question) {
        $question = parent::data_preprocessing($question);

        if (isset($question->options->correctanswer)) {
            $question->answer_bracket_notation = $question->options->correctanswer;
            $question->allowimport = $question->options->allowimport;
            $question->showfunctions = $question->options->showfunctions;
            $question->functionslist = $question->options->functionslist;
            $question->treeweight = $question->options->treeweight;
            $question->posweight = $question->options->posweight;
            $question->rootweight = $question->options->rootweight;
            $question->hierarchyweight = $question->options->hierarchyweight;
            $question->casesensitive = isset($question->options->casesensitive) ? $question->options->casesensitive : 0;
        }

        return $question;
    }

    public function qtype() {
        return 'syntree';
    }
}

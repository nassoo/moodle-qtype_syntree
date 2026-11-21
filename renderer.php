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
 * Renderer class for the Syntax Tree question type.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/question/type/rendererbase.php');

/**
 * Renderer for Syntax Tree questions.
 */
class qtype_syntree_renderer extends qtype_renderer {
    /**
     * Render the question text, student tree editor, and syntactic functions inputs.
     *
     * @param question_attempt $qa The question attempt to display.
     * @param question_display_options $options Display options.
     * @return string HTML output.
     */
    public function formulation_and_controls(question_attempt $qa, question_display_options $options) {
        $question = $qa->get_question();
        $response = $qa->get_last_qt_var('answer', '');

        $inputname = $qa->get_qt_field_name('answer');
        $containerid = 'syntree-student-editor-' . $inputname;
        $allowimport = !empty($question->allowimport);

        $html = '';
        $html .= html_writer::tag('div', $question->format_questiontext($qa), ['class' => 'qtext']);

        // 1. Student editor.
        // Traces are not saved in the answer and not graded yet, so they are always off.
        $html .= html_writer::start_tag('div', [
            'id' => $containerid,
            'style' => 'width:100%; min-height:500px; border:1px solid #ccc; margin-top:20px; ' .
                'background:#fafafa; position:relative;',
            'data-allowimport' => (int)$allowimport,
            'data-allowtraces' => 0,
            'data-mode' => 'student',
        ]);
        $html .= html_writer::end_tag('div');

        // Output via html_writer so attribute values are escaped automatically.
        $hiddenid = 'id_' . $inputname;
        $html .= html_writer::empty_tag('input', [
            'type' => 'hidden',
            'name' => $inputname,
            'id'   => $hiddenid,
            'value' => $response,
        ]);

        // 2. Syntactic functions table.
        if ($question->showfunctions) {
            $html .= html_writer::start_tag(
                'div',
                ['class' => 'syntree-functions-container', 'style' => 'margin-top:20px; margin-bottom: 20px;']
            );

            $html .= html_writer::start_tag('table', ['class' => 'generaltable', 'style' => 'width:100%; max-width: 600px;']);
            $html .= html_writer::start_tag('thead');
            $html .= html_writer::start_tag('tr');
            $html .= html_writer::tag('th', get_string('phrase_word', 'qtype_syntree'));
            $html .= html_writer::tag('th', get_string('syntactic_function', 'qtype_syntree'));
            $html .= html_writer::end_tag('tr');
            $html .= html_writer::end_tag('thead');

            $html .= html_writer::start_tag('tbody');
            $idx = 0;
            foreach (explode("\n", (string)$question->functionslist) as $line) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }

                $parts = explode('|', $line);
                $phrase = trim($parts[0]);

                $attributes = [
                    'type' => 'text',
                    'name' => $qa->get_qt_field_name('func_' . $idx),
                    'value' => $qa->get_last_qt_var('func_' . $idx, ''),
                    'class' => 'form-control',
                    'style' => 'width:100%',
                ];
                if ($options->readonly) {
                    $attributes['readonly'] = 'readonly';
                }

                $html .= html_writer::start_tag('tr');
                $html .= html_writer::tag('td', s($phrase));
                $html .= html_writer::tag('td', html_writer::empty_tag('input', $attributes));
                $html .= html_writer::end_tag('tr');
                $idx++;
            }
            $html .= html_writer::end_tag('tbody');
            $html .= html_writer::end_tag('table');
            $html .= html_writer::end_tag('div');
        }

        // Load JS bundle.
        $initialdata = $response;

        // Extract only the leaf symbols (words) from the correct bracket notation.
        if (empty($initialdata)) {
            $correctanswer = isset($question->correctanswer) ? $question->correctanswer : '';
            if (preg_match_all('/\[\S+\s+([^\[\]]+)\]/', $correctanswer, $matches)) {
                $initialdata = implode('|', array_map('trim', $matches[1]));
            } else {
                $initialdata = ""; // Fallback.
            }
        }

        $this->page->requires->strings_for_js(qtype_syntree::JS_STRINGS, 'qtype_syntree');
        $this->page->requires->js_call_amd('qtype_syntree/editor_core', 'init', [[
            'bundleUrl'   => qtype_syntree::get_bundle_url(),
            'containerId' => $containerid,
            'inputId'     => $hiddenid,
            'mode'        => 'student',
            'initialData' => $initialdata,
            'readonly'    => $options->readonly,
            'allowtraces' => false,
            'allowimport' => $allowimport,
        ]]);

        return $html;
    }

    /**
     * The grading breakdown belongs to the student's own answer, so it is shown as specific feedback only.
     * General feedback is printed separately by the question engine.
     *
     * @param question_attempt $qa The question attempt being reviewed.
     * @return string HTML output.
     */
    public function specific_feedback(question_attempt $qa) {
        $question = $qa->get_question();
        // The last step is often the "finish" step without any answer data, so take the last step that has some.
        $response = $qa->get_last_qt_data();

        if (empty($response['answer'])) {
            return '';
        }

        $breakdown = $question->get_grading_breakdown($response);

        $html = html_writer::start_tag('div', [
            'class' => 'syntree-grading-breakdown',
            'style' => 'margin-top:20px; border:1px solid #ccc; padding:15px; border-radius:5px; background-color:#f9f9f9;',
        ]);
        $html .= html_writer::tag('h3', get_string('grading_details', 'qtype_syntree'), ['style' => 'margin-top:0;']);

        // Tree score.
        $treescore = round($breakdown['tree_score'] * 100, 1);
        $treeclass = ($treescore >= 99) ? 'text-success' : (($treescore > 0) ? 'text-warning' : 'text-danger');

        $html .= html_writer::start_tag('div', ['style' => 'margin-bottom:10px;']);
        $html .= html_writer::tag('strong', get_string('tree_score', 'qtype_syntree') . ": ");
        $html .= html_writer::tag('span', $treescore . '%', ['class' => $treeclass, 'style' => 'font-weight:bold;']);
        if ($question->showfunctions) {
            $html .= ' (' . get_string('treeweight', 'qtype_syntree') . ': ' . $breakdown['tree_weight'] . '%)';
        }
        $html .= html_writer::end_tag('div');

        // Detailed IRLA breakdown.
        $html .= html_writer::start_tag('div', [
            'style' => 'font-size: 0.9em; color: #666; margin-bottom: 15px; padding: 10px; ' .
                'background: #fff; border-radius: 4px; border: 1px inset #eee;',
        ]);
        $html .= html_writer::tag(
            'div',
            html_writer::tag('strong', get_string('pos_score', 'qtype_syntree', $breakdown['posweight']) . ':') .
                ' ' . round($breakdown['pos_score'] * 100, 1) . '%'
        );
        $html .= html_writer::tag(
            'div',
            html_writer::tag('strong', get_string('root_score', 'qtype_syntree', $breakdown['rootweight']) . ':') .
                ' ' . round($breakdown['root_score'] * 100, 1) . '%'
        );
        $html .= html_writer::tag(
            'div',
            html_writer::tag('strong', get_string('hierarchy_score', 'qtype_syntree', $breakdown['hierarchyweight']) . ':') .
                ' ' . round($breakdown['hierarchy_score'] * 100, 1) . '%'
        );

        if (!empty($breakdown['word_debug'])) {
            $html .= html_writer::start_tag('details', ['style' => 'margin-top: 10px; cursor: pointer;']);
            $html .= html_writer::tag('summary', get_string('paths_comparison', 'qtype_syntree'));
            $html .= html_writer::start_tag(
                'ul',
                ['style' => 'list-style: none; padding-left: 10px; font-family: monospace;']
            );
            foreach ($breakdown['word_debug'] as $line) {
                $html .= html_writer::tag('li', s($line), ['style' => 'border-bottom: 1px dotted #eee; padding: 2px 0;']);
            }
            $html .= html_writer::end_tag('ul');
            $html .= html_writer::end_tag('details');
        }
        $html .= html_writer::end_tag('div');

        // Functions score.
        if ($question->showfunctions) {
            $funcscore = round($breakdown['functions_grade'] * 100, 1);
            $funcclass = ($funcscore >= 99) ? 'text-success' : (($funcscore > 0) ? 'text-warning' : 'text-danger');

            $html .= html_writer::start_tag('div', ['style' => 'margin-bottom:10px;']);
            $html .= html_writer::tag('strong', get_string('functions_score', 'qtype_syntree') . ": ");
            $html .= html_writer::tag('span', $funcscore . '%', ['class' => $funcclass, 'style' => 'font-weight:bold;']);
            $html .= ' (' . get_string('functions_weight', 'qtype_syntree') . ': ' . $breakdown['functions_weight'] . '%)';
            $html .= html_writer::end_tag('div');

            // Detailed functions table.
            $html .= html_writer::start_tag('table', ['class' => 'generaltable', 'style' => 'width:100%; margin-bottom:0;']);
            $html .= html_writer::start_tag('thead');
            $html .= html_writer::start_tag('tr');
            $html .= html_writer::tag('th', get_string('phrase', 'qtype_syntree'));
            $html .= html_writer::tag('th', get_string('student_answer', 'qtype_syntree'));
            $html .= html_writer::tag('th', get_string('expected_function', 'qtype_syntree'));
            $html .= html_writer::tag('th', get_string('score', 'qtype_syntree'));
            $html .= html_writer::end_tag('tr');
            $html .= html_writer::end_tag('thead');
            $html .= html_writer::start_tag('tbody');

            foreach ($breakdown['functions_details'] as $detail) {
                $rowclass = ($detail['score'] >= 0.99)
                    ? 'table-success'
                    : (($detail['score'] > 0) ? 'table-warning' : 'table-danger');
                $html .= html_writer::start_tag('tr', ['class' => $rowclass]);
                $html .= html_writer::tag('td', s($detail['phrase']));
                $html .= html_writer::tag('td', s($detail['student']));
                $html .= html_writer::tag('td', s($detail['expected']));
                $html .= html_writer::tag('td', round($detail['score'] * 100) . '%');
                $html .= html_writer::end_tag('tr');
            }
            $html .= html_writer::end_tag('tbody');
            $html .= html_writer::end_tag('table');
        }

        $html .= html_writer::end_tag('div');
        return $html;
    }

    /**
     * Render the read-only reference tree as the correct response.
     *
     * @param question_attempt $qa The question attempt being reviewed.
     * @return string HTML output.
     */
    public function correct_response(question_attempt $qa) {
        $question = $qa->get_question();

        // Strip alternative labels from correctanswer for display (e.g. [IP|S ...] becomes [IP ...]).
        $displaycorrectanswer = \qtype_syntree\evaluator::strip_alternatives($question->correctanswer);

        $html = html_writer::tag(
            'span',
            get_string('answer_bracket_notation', 'qtype_syntree') . ': ' . s($displaycorrectanswer)
        );

        // Ids derived from the attempt, so several questions on one review page never clash.
        $containerid = 'syntree-correct-editor-' . $qa->get_qt_field_name('correct');
        $hiddenid = 'id_correct_' . $qa->get_qt_field_name('correct');

        $html .= html_writer::start_tag('div', [
            'id' => $containerid,
            'style' => 'width:100%; min-height:400px; border:1px solid #ccc; margin-top:10px; ' .
                'background:#fafafa; position:relative;',
        ]);
        $html .= html_writer::end_tag('div');

        $html .= html_writer::empty_tag('input', [
            'type' => 'hidden',
            'id'   => $hiddenid,
            'value' => $displaycorrectanswer,
        ]);

        $this->page->requires->strings_for_js(qtype_syntree::JS_STRINGS, 'qtype_syntree');
        $this->page->requires->js_call_amd('qtype_syntree/editor_core', 'init', [[
            'bundleUrl'   => qtype_syntree::get_bundle_url(),
            'containerId' => $containerid,
            'inputId'     => $hiddenid,
            'mode'        => 'student',
            'initialData' => $displaycorrectanswer,
            'readonly'    => true,
            'allowtraces' => false,
            'allowimport' => false, // Never allow import in review mode for students.
        ]]);

        return $html;
    }
}

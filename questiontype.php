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
 * The Syntax Tree question type class.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/questionlib.php');
require_once($CFG->dirroot . '/question/engine/lib.php');
require_once($CFG->dirroot . '/question/type/questiontypebase.php');

/**
 * The Syntax Tree question type class.
 */
class qtype_syntree extends question_type {
    /**
     * Language string keys passed to JavaScript (AMD loader and bundle UI).
     */
    public const JS_STRINGS = [
        'loader_loading',
        'loader_error_init_missing',
        'loader_error_script_load',
        'loader_error_load_failed',
        'ui_import_bracket_placeholder',
        'ui_copy_title',
        'ui_copy',
        'ui_copied',
        'ui_clear_input_title',
        'ui_import_bracket',
        'ui_export_bracket',
        'ui_clear_screen',
        'ui_help',
        'ui_toggle_toolbars',
        'ui_modal_dnd_title',
        'ui_modal_dnd_question',
        'ui_dnd_child1_default',
        'ui_dnd_child2_default',
        'ui_dnd_child1',
        'ui_dnd_child2',
        'ui_dnd_swap',
        'ui_cancel',
        'ui_modal_delete_title',
        'ui_modal_delete_question',
        'ui_delete_keep',
        'ui_delete_cascade',
        'ui_modal_help_title',
        'ui_close',
        'ui_loading_instructions',
        'ui_guide_load_error',
        'ui_disconnected_warning',
        'ui_invalid_bracket',
        'ui_node_label_placeholder',
        'ui_node_phrase_placeholder',
        'ui_node_word_placeholder',
        'ui_fab_undo',
        'ui_fab_redo',
        'ui_fab_zoom_in',
        'ui_fab_zoom_out',
        'ui_fab_reset_zoom',
        'ui_fab_center_view',
    ];

    /**
     * URL of the editor bundle. The version parameter follows the file's modification time,
     * so browsers cache it but still pick up a new build right away.
     *
     * @return string
     */
    public static function get_bundle_url() {
        $file = __DIR__ . '/vue_app/dist/syntree.bundle.js';
        $version = file_exists($file) ? filemtime($file) : 0;
        return (new moodle_url('/question/type/syntree/vue_app/dist/syntree.bundle.js', ['v' => $version]))->out(false);
    }

    /**
     * Save the type-specific options for a syntax tree question.
     *
     * @param stdClass $question Question form data.
     * @return bool
     */
    public function save_question_options($question) {
        global $DB;

        // Extract the correct answer bracket notation from the form.
        $bracketnotation = '';
        if (isset($question->answer_bracket_notation)) {
            $bracketnotation = trim($question->answer_bracket_notation);
        }

        // We only have one correct answer per question for now.
        $options = $DB->get_record('qtype_syntree_options', ['questionid' => $question->id]);
        $isnew = !$options;
        if ($isnew) {
            $options = new stdClass();
            $options->questionid = $question->id;
        }

        $options->correctanswer = $bracketnotation;
        $options->allowtraces = isset($question->allowtraces) ? $question->allowtraces : 0;
        $options->allowimport = isset($question->allowimport) ? $question->allowimport : 0;
        $options->showfunctions = isset($question->showfunctions) ? $question->showfunctions : 0;
        $options->functionslist = isset($question->functionslist) ? $question->functionslist : '';
        $options->treeweight = isset($question->treeweight) ? (int)$question->treeweight : 70;
        $options->posweight = isset($question->posweight) ? (int)$question->posweight : 15;
        $options->rootweight = isset($question->rootweight) ? (int)$question->rootweight : 5;
        $options->hierarchyweight = isset($question->hierarchyweight) ? (int)$question->hierarchyweight : 80;
        $options->casesensitive = !empty($question->casesensitive) ? 1 : 0;

        if ($isnew) {
            $DB->insert_record('qtype_syntree_options', $options);
        } else {
            $DB->update_record('qtype_syntree_options', $options);
        }

        return true;
    }

    /**
     * Load the type-specific options for a syntax tree question.
     *
     * @param stdClass $question Question object to populate with options.
     * @return bool
     */
    public function get_question_options($question) {
        global $DB;
        parent::get_question_options($question);
        $options = $DB->get_record('qtype_syntree_options', ['questionid' => $question->id]);
        if ($options) {
            $question->options = $options;
        }
        return true;
    }

    /**
     * Initialise the runtime question instance from loaded question data.
     *
     * @param question_definition $question Target question instance.
     * @param stdClass $questiondata Loaded question data from the database.
     * @return void
     */
    protected function initialise_question_instance(question_definition $question, $questiondata) {
        parent::initialise_question_instance($question, $questiondata);
        // The options record can be missing, e.g. for a question restored from a backup made before backup support existed.
        if (isset($questiondata->options->correctanswer)) {
            $o = $questiondata->options;
            $question->correctanswer = $o->correctanswer;
            $question->allowtraces = $o->allowtraces;
            $question->allowimport = $o->allowimport;
            $question->showfunctions = $o->showfunctions;
            $question->functionslist = $o->functionslist;
            $question->treeweight = $o->treeweight;
            $question->posweight = $o->posweight;
            $question->rootweight = $o->rootweight;
            $question->hierarchyweight = $o->hierarchyweight;
            $question->casesensitive = isset($o->casesensitive) ? $o->casesensitive : 0;
        } else {
            $question->correctanswer = '';
            $question->allowtraces = 0;
            $question->allowimport = 0;
            $question->showfunctions = 0;
            $question->functionslist = '';
            $question->treeweight = 70;
            $question->posweight = 15;
            $question->rootweight = 5;
            $question->hierarchyweight = 80;
            $question->casesensitive = 0;
        }
    }

    /**
     * Delete the type-specific options for a question.
     *
     * @param int $questionid Question ID.
     * @param int $contextid Context ID.
     * @return void
     */
    public function delete_question($questionid, $contextid) {
        global $DB;
        $DB->delete_records('qtype_syntree_options', ['questionid' => $questionid]);
        parent::delete_question($questionid, $contextid);
    }

    /**
     * Export syntax tree options to Moodle XML format.
     *
     * @param stdClass $question Question object.
     * @param qformat_xml $format XML format helper.
     * @param mixed $extra Extra data (unused).
     * @return string XML fragment.
     */
    public function export_to_xml($question, qformat_xml $format, $extra = null) {
        $output = '';
        if (isset($question->options->correctanswer)) {
            $output .= "    <correctanswer>" . $format->writetext($question->options->correctanswer) . "</correctanswer>\n";
        }
        if (isset($question->options->allowtraces)) {
            $output .= "    <allowtraces>{$question->options->allowtraces}</allowtraces>\n";
        }
        if (isset($question->options->allowimport)) {
            $output .= "    <allowimport>{$question->options->allowimport}</allowimport>\n";
        }
        if (isset($question->options->showfunctions)) {
            $output .= "    <showfunctions>{$question->options->showfunctions}</showfunctions>\n";
        }
        if (isset($question->options->functionslist)) {
            $output .= "    <functionslist>" . $format->writetext($question->options->functionslist) . "</functionslist>\n";
        }
        if (isset($question->options->treeweight)) {
            $output .= "    <treeweight>{$question->options->treeweight}</treeweight>\n";
        }
        if (isset($question->options->posweight)) {
            $output .= "    <posweight>{$question->options->posweight}</posweight>\n";
        }
        if (isset($question->options->rootweight)) {
            $output .= "    <rootweight>{$question->options->rootweight}</rootweight>\n";
        }
        if (isset($question->options->hierarchyweight)) {
            $output .= "    <hierarchyweight>{$question->options->hierarchyweight}</hierarchyweight>\n";
        }
        if (isset($question->options->casesensitive)) {
            $output .= "    <casesensitive>{$question->options->casesensitive}</casesensitive>\n";
        }
        return $output;
    }

    /**
     * Reads a text field that Moodle's own export wraps in <text>, while hand-made files may contain the plain value.
     *
     * @param array $data Parsed XML data array.
     * @param qformat_xml $format XML format helper.
     * @param string $field XML element name.
     * @param string $default Fallback value if missing.
     * @return string
     */
    protected function import_text_field($data, qformat_xml $format, $field, $default) {
        $value = $format->getpath($data, ['#', $field, 0, '#', 'text', 0, '#'], null);
        if ($value === null) {
            $value = $format->getpath($data, ['#', $field, 0, '#'], $default);
        }
        return is_string($value) ? trim($value) : $default;
    }

    /**
     * Import a syntax tree question from Moodle XML data.
     *
     * @param array $data Parsed XML data array.
     * @param stdClass|null $question Existing question object or null.
     * @param qformat_xml $format XML format helper.
     * @param mixed $extra Extra data (unused).
     * @return stdClass|false Imported question object, or false if not a syntree question.
     */
    public function import_from_xml($data, $question, qformat_xml $format, $extra = null) {
        if (!isset($data['@']['type']) || $data['@']['type'] != 'syntree') {
            return false;
        }

        $question = $format->import_headers($data);
        $question->qtype = 'syntree';

        $question->answer_bracket_notation = $this->import_text_field($data, $format, 'correctanswer', '');
        $question->allowtraces = $format->getpath($data, ['#', 'allowtraces', 0, '#'], 0, true);
        $question->allowimport = $format->getpath($data, ['#', 'allowimport', 0, '#'], 0, true);
        $question->showfunctions = $format->getpath($data, ['#', 'showfunctions', 0, '#'], 0, true);
        $question->functionslist = $this->import_text_field($data, $format, 'functionslist', '');
        $question->treeweight = $format->getpath($data, ['#', 'treeweight', 0, '#'], 70, true);
        $question->posweight = $format->getpath($data, ['#', 'posweight', 0, '#'], 15, true);
        $question->rootweight = $format->getpath($data, ['#', 'rootweight', 0, '#'], 5, true);
        $question->hierarchyweight = $format->getpath($data, ['#', 'hierarchyweight', 0, '#'], 80, true);
        $question->casesensitive = $format->getpath($data, ['#', 'casesensitive', 0, '#'], 0, true);

        return $question;
    }
}

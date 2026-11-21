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
 * Restore support for the Syntax Tree question type.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Restores the qtype_syntree_options record of each question.
 */
class restore_qtype_syntree_plugin extends restore_qtype_plugin {
    /**
     * Returns the paths to be handled by the plugin at question level.
     *
     * @return restore_path_element[]
     */
    protected function define_question_plugin_structure() {
        return [
            new restore_path_element('syntree', $this->get_pathfor('/syntree')),
        ];
    }

    /**
     * Process the qtype/syntree element.
     *
     * @param array $data
     * @return void
     */
    public function process_syntree($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;

        // Only questions created by this restore need their options; mapped ones already have them.
        $questioncreated = $this->get_mappingid('question_created', $this->get_old_parentid('question')) ? true : false;
        if ($questioncreated) {
            $data->questionid = $this->get_new_parentid('question');
            if (!isset($data->casesensitive)) {
                $data->casesensitive = 0; // Backups made before the option existed.
            }
            $newitemid = $DB->insert_record('qtype_syntree_options', $data);
            $this->set_mapping('qtype_syntree_options', $oldid, $newitemid);
        }
    }
}

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
 * Backup support for the Syntax Tree question type.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Adds the qtype_syntree_options record of each question to course and question bank backups.
 */
class backup_qtype_syntree_plugin extends backup_qtype_plugin {

    /**
     * Returns the qtype information to attach to the question element.
     */
    protected function define_question_plugin_structure() {
        // Define the virtual plugin element with the condition to fulfill.
        $plugin = $this->get_plugin_element(null, '../../qtype', 'syntree');

        // Create one standard named plugin element (the visible container) and connect it ASAP.
        $pluginwrapper = new backup_nested_element($this->get_recommended_name());
        $plugin->add_child($pluginwrapper);

        // The element is named after the qtype, which is what the default restore conversion expects.
        $options = new backup_nested_element('syntree', array('id'), array(
            'correctanswer', 'allowtraces', 'showfunctions', 'functionslist', 'treeweight',
            'allowimport', 'posweight', 'rootweight', 'hierarchyweight', 'casesensitive'));
        $pluginwrapper->add_child($options);

        $options->set_source_table('qtype_syntree_options', array('questionid' => backup::VAR_PARENTID));

        // No ids to annotate and no files of our own.
        return $plugin;
    }
}

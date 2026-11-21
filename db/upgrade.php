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
 * Upgrade code for the Syntax Tree question type.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Upgrade steps for the Syntax Tree question type.
 *
 * @param int $oldversion The version we are upgrading from.
 * @return bool
 */
function xmldb_qtype_syntree_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026030804) {
        $table = new xmldb_table('qtype_syntree_options');
        $field = new xmldb_field('allowtraces', XMLDB_TYPE_INTEGER, '2', null, XMLDB_NOTNULL, null, '0', 'correctanswer');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_plugin_savepoint(true, 2026030804, 'qtype', 'syntree');
    }

    if ($oldversion < 2026030900) {
        $table = new xmldb_table('qtype_syntree_options');

        $field1 = new xmldb_field('showfunctions', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0', 'allowtraces');
        if (!$dbman->field_exists($table, $field1)) {
            $dbman->add_field($table, $field1);
        }

        $field2 = new xmldb_field('functionslist', XMLDB_TYPE_TEXT, null, null, null, null, null, 'showfunctions');
        if (!$dbman->field_exists($table, $field2)) {
            $dbman->add_field($table, $field2);
        }

        $field3 = new xmldb_field('treeweight', XMLDB_TYPE_INTEGER, '3', null, XMLDB_NOTNULL, null, '70', 'functionslist');
        if (!$dbman->field_exists($table, $field3)) {
            $dbman->add_field($table, $field3);
        }

        upgrade_plugin_savepoint(true, 2026030900, 'qtype', 'syntree');
    }

    if ($oldversion < 2026030901) {
        $table = new xmldb_table('qtype_syntree_options');
        $field = new xmldb_field('allowimport', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0', 'treeweight');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_plugin_savepoint(true, 2026030901, 'qtype', 'syntree');
    }
    if ($oldversion < 2026060400) {
        $table = new xmldb_table('qtype_syntree_options');

        $field1 = new xmldb_field('showfunctions', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0', 'allowtraces');
        if (!$dbman->field_exists($table, $field1)) {
            $dbman->add_field($table, $field1);
        }

        $field2 = new xmldb_field('functionslist', XMLDB_TYPE_TEXT, null, null, null, null, null, 'showfunctions');
        if (!$dbman->field_exists($table, $field2)) {
            $dbman->add_field($table, $field2);
        }

        $field3 = new xmldb_field('treeweight', XMLDB_TYPE_INTEGER, '3', null, XMLDB_NOTNULL, null, '70', 'functionslist');
        if (!$dbman->field_exists($table, $field3)) {
            $dbman->add_field($table, $field3);
        }

        $field4 = new xmldb_field('allowimport', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0', 'treeweight');
        if (!$dbman->field_exists($table, $field4)) {
            $dbman->add_field($table, $field4);
        }

        upgrade_plugin_savepoint(true, 2026060400, 'qtype', 'syntree');
    }

    if ($oldversion < 2026071900) {
        $table = new xmldb_table('qtype_syntree_options');

        $field5 = new xmldb_field('posweight', XMLDB_TYPE_INTEGER, '3', null, XMLDB_NOTNULL, null, '15', 'allowimport');
        if (!$dbman->field_exists($table, $field5)) {
            $dbman->add_field($table, $field5);
        }

        $field6 = new xmldb_field('rootweight', XMLDB_TYPE_INTEGER, '3', null, XMLDB_NOTNULL, null, '5', 'posweight');
        if (!$dbman->field_exists($table, $field6)) {
            $dbman->add_field($table, $field6);
        }

        $field7 = new xmldb_field('hierarchyweight', XMLDB_TYPE_INTEGER, '3', null, XMLDB_NOTNULL, null, '80', 'rootweight');
        if (!$dbman->field_exists($table, $field7)) {
            $dbman->add_field($table, $field7);
        }

        upgrade_plugin_savepoint(true, 2026071900, 'qtype', 'syntree');
    }

    if ($oldversion < 2026111900) {
        $table = new xmldb_table('qtype_syntree_options');

        $field8 = new xmldb_field('casesensitive', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0', 'hierarchyweight');
        if (!$dbman->field_exists($table, $field8)) {
            $dbman->add_field($table, $field8);
        }

        upgrade_plugin_savepoint(true, 2026111900, 'qtype', 'syntree');
    }

    // Without this Moodle treats the upgrade as failed whenever the version is bumped without a new savepoint.
    return true;
}

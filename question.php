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
 * Class representing a Syntax Tree question.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/question/type/questionbase.php');

/**
 * Represents a Syntax Tree question.
 */
class qtype_syntree_question extends question_graded_automatically {

    /** @var string The correct bracket notation. */
    public $correctanswer;

    /** @var int Whether traces are allowed. */
    public $allowtraces;

    /** @var int Whether students can import bracket notation. */
    public $allowimport;

    /** @var int Whether to show syntactic functions table. */
    public $showfunctions;

    /** @var string The configuration of functions and answers. */
    public $functionslist;

    /** @var int Percentage weight of the tree structure. */
    public $treeweight;

    /** @var int Percentage weight of POS tags within the tree score. */
    public $posweight;

    /** @var int Percentage weight of the root label within the tree score. */
    public $rootweight;

    /** @var int Percentage weight of the hierarchy within the tree score. */
    public $hierarchyweight;

    /** @var int Whether node labels are compared case-sensitively (e.g. vP vs VP). */
    public $casesensitive;

    /**
     * Returns the non-empty lines of the functions list. Each line gets one func_N field, in this order.
     */
    protected function get_function_lines() {
        $result = [];
        foreach (explode("\n", (string)$this->functionslist) as $line) {
            $line = trim($line);
            if ($line !== '') {
                $result[] = $line;
            }
        }
        return $result;
    }

    public function get_expected_data() {
        $expected = array('answer' => PARAM_RAW);
        if ($this->showfunctions) {
            foreach (array_keys($this->get_function_lines()) as $index) {
                $expected['func_' . $index] = PARAM_TEXT;
            }
        }
        return $expected;
    }

    public function summarise_response(array $response) {
        $summary = isset($response['answer']) ? trim($response['answer']) : '';

        if ($this->showfunctions) {
            $functions = [];
            foreach (array_keys($this->get_function_lines()) as $index) {
                $value = isset($response['func_' . $index]) ? trim($response['func_' . $index]) : '';
                if ($value !== '') {
                    $functions[] = $value;
                }
            }
            if ($functions) {
                $summary .= ($summary !== '' ? ' | ' : '') . implode('; ', $functions);
            }
        }

        return $summary !== '' ? $summary : null;
    }

    public function is_complete_response(array $response) {
        // The editor saves the given words as soon as it loads, so a non-empty answer alone
        // does not mean the student did anything. Require a real label or a filled-in function.
        $answer = isset($response['answer']) ? $response['answer'] : '';
        if (qtype_syntree_evaluator::has_real_label($answer)) {
            return true;
        }

        if ($this->showfunctions) {
            foreach (array_keys($this->get_function_lines()) as $index) {
                if (isset($response['func_' . $index]) && trim($response['func_' . $index]) !== '') {
                    return true;
                }
            }
        }
        return false;
    }

    public function is_gradable_response(array $response) {
        return $this->is_complete_response($response);
    }

    public function is_same_response(array $prevresponse, array $newresponse) {
        // Compare every field, not just the tree, otherwise a change to the functions alone is discarded.
        foreach (array_keys($this->get_expected_data()) as $key) {
            if (!question_utils::arrays_same_at_key_missing_is_blank($prevresponse, $newresponse, $key)) {
                return false;
            }
        }
        return true;
    }

    public function get_validation_error(array $response) {
        if ($this->is_gradable_response($response)) {
            return '';
        }
        return get_string('pleaseenteryouranswer', 'qtype_syntree');
    }

    public function grade_response(array $response) {
        $breakdown = $this->get_grading_breakdown($response);
        $final_grade = round($breakdown['final_grade'], 2);

        if ($final_grade >= 0.99) {
            return array(1.0, question_state::$gradedright);
        } else if ($final_grade > 0.0) {
            return array($final_grade, question_state::$gradedpartial);
        } else {
            return array(0.0, question_state::$gradedwrong);
        }
    }

    /**
     * Calculates a detailed breakdown of the grade for feedback purposes.
     */
    public function get_grading_breakdown(array $response) {
        $student_tree = isset($response['answer']) ? trim($response['answer']) : '';
        $correct_tree = trim($this->correctanswer);

        // 1. Grade the Tree Structure
        $tree_score = 0.0;
        $pos_score = 0.0;
        $root_score = 0.0;
        $hierarchy_score = 0.0;
        $dbg_lines = [];

        if ($student_tree !== '') {
            $student_clean = preg_replace('/\s+/', '', $student_tree);
            $correct_clean = preg_replace('/\s+/', '', $correct_tree);

            if ($student_clean === $correct_clean) {
                $tree_score = 1.0;
                $pos_score = 1.0;
                $root_score = 1.0;
                $hierarchy_score = 1.0;
            } else {
                $c_data = qtype_syntree_evaluator::get_leaf_paths($correct_tree);
                $s_data = qtype_syntree_evaluator::get_leaf_paths($student_tree);

                $c_paths = $c_data['paths'];
                $s_paths = $s_data['paths'];

                // Pair each correct word with the same word in the student's tree, so that one missing
                // or extra word does not shift every word after it. Extra student words count as misses.
                $alignment = qtype_syntree_evaluator::align_words($c_paths, $s_paths);
                $total_words = max(count($c_paths), count($s_paths));

                if (count($c_paths) === 0) {
                    $tree_score = 0.0;
                    $pos_score = 0.0;
                    $hierarchy_score = 0.0;
                } else {
                    // 1. POS Score (15%)
                    $pos_count = 0;
                    foreach ($alignment as $ci => $si) {
                        if ($this->irla_labels_equal_v4((string)$s_paths[$si]['pos'], (string)$c_paths[$ci]['pos'])) {
                            $pos_count++;
                        }
                    }
                    $pos_score = $pos_count / $total_words;

                    // 2. Root Score (5%)
                    $root_score = 0.0;
                    if (!$s_data['is_multiple'] && !empty($s_data['root'])) {
                        if ($this->irla_labels_equal_v4((string)$s_data['root'], (string)$c_data['root'])) {
                            $root_score = 1.0;
                        }
                    }

                    // 3. Hierarchy Score (80%)
                    $h_sum = 0;
                    for ($i = 0; $i < count($c_paths); $i++) {
                        $w_score = 0.0;
                        $msg = "";
                        if (isset($alignment[$i])) {
                            $cp = $c_paths[$i]['path'];
                            $sp = $s_paths[$alignment[$i]]['path'];

                            if (empty($sp) && $s_data['is_multiple'] && !$c_data['is_multiple']) {
                                // The word is not connected to anything in the student's forest of trees.
                                $w_score = 0.0;
                                $msg = "Not attached to the tree";
                            } else if (empty($cp) && empty($sp)) {
                                $w_score = 1.0;
                                $msg = "Match (both empty)";
                            } else if (empty($cp) || empty($sp)) {
                                $w_score = 0.0;
                                $msg = "Mismatch (one empty)";
                            } else {
                                $dist = $this->irla_token_distance_v4($sp, $cp, $seg_logs);
                                $max_len = max(count($sp), count($cp));
                                $w_score = max(0, 1.0 - ($dist / $max_len));
                                $msg = "Dist: " . round($dist, 2) . "/$max_len | Segs:{" . implode("|", $seg_logs) . "}";
                            }
                        } else {
                            $msg = "Missing student word";
                        }
                        $h_sum += $w_score;
                        $dbg_lines[] = "Word: " . $c_paths[$i]['word'] . " | Score: " . round($w_score, 2) . " | $msg";
                    }
                    $hierarchy_score = $h_sum / $total_words;

                    $pw = isset($this->posweight) ? ($this->posweight / 100.0) : 0.15;
                    $rw = isset($this->rootweight) ? ($this->rootweight / 100.0) : 0.05;
                    $hw = isset($this->hierarchyweight) ? ($this->hierarchyweight / 100.0) : 0.80;
                    $tree_score = ($pos_score * $pw) + ($root_score * $rw) + ($hierarchy_score * $hw);
                }
            }
        }

        // 2. Grade the Syntactic Functions
        $func_details = [];
        $func_grade = 1.0;
        if ($this->showfunctions) {
            $func_results = $this->grade_functions($response);
            $func_grade = $func_results['grade'];
            $func_details = $func_results['details'];
        }

        // 3. Combine Grades
        $tree_weight = $this->treeweight / 100.0;
        $func_weight = 1.0 - $tree_weight;

        if (!$this->showfunctions) {
            $final_grade = $tree_score;
        } else {
            $final_grade = ($tree_score * $tree_weight) + ($func_grade * $func_weight);
        }

        return [
            'tree_score'      => $tree_score,
            'tree_weight'     => $this->treeweight,
            'posweight'       => isset($this->posweight) ? $this->posweight : 15,
            'rootweight'      => isset($this->rootweight) ? $this->rootweight : 5,
            'hierarchyweight' => isset($this->hierarchyweight) ? $this->hierarchyweight : 80,
            'pos_score'       => $pos_score,
            'root_score'      => $root_score,
            'hierarchy_score' => $hierarchy_score,
            'word_debug'      => $dbg_lines,
            'functions_grade' => $func_grade,
            'functions_weight'=> $this->showfunctions ? (100 - $this->treeweight) : 0,
            'functions_details' => $func_details,
            'final_grade'     => $final_grade
        ];
    }

    /**
     * Helper to grade the individual function responses.
     */
    protected function grade_functions(array $response) {
        $total_items = 0;
        $earned_marks = 0;
        $details = [];

        // The index must follow get_expected_data(), which numbers every non-empty line.
        foreach ($this->get_function_lines() as $index => $line) {
            $total_items++;
            $parts = explode('|', $line);
            $phrase = trim($parts[0]);
            if (count($parts) < 2) {
                $details[] = [
                    'phrase' => $phrase,
                    'student' => '',
                    'expected' => '?',
                    'score' => 0
                ];
                continue;
            }

            $student_ans_raw = isset($response['func_' . $index]) ? trim($response['func_' . $index]) : '';
            $student_ans = mb_strtolower($student_ans_raw);
            $config_str = trim($parts[1]);

            $variants = explode(';', $config_str);
            $best_match_mark = 0;
            $expected_display = '';

            foreach ($variants as $v_idx => $variant) {
                $v_parts = explode('=', $variant);
                $v_text = trim(mb_strtolower($v_parts[0]));
                $v_mark = isset($v_parts[1]) ? (int)trim($v_parts[1]) : 100;

                if ($v_idx === 0) {
                    $expected_display = trim($v_parts[0]);
                }

                if ($student_ans === $v_text) {
                    $best_match_mark = max($best_match_mark, $v_mark);
                }
            }

            $earned_marks += ($best_match_mark / 100.0);
            $details[] = [
                'phrase' => $phrase,
                'student' => $student_ans_raw,
                'expected' => $expected_display,
                'score' => $best_match_mark / 100.0
            ];
        }

        $grade = ($total_items > 0) ? ($earned_marks / $total_items) : 1.0;
        return ['grade' => $grade, 'details' => $details];
    }

    /**
     * RENAMED V4: Strictly check if two labels match (including aliases such as IP|S in the reference).
     */
    protected function irla_labels_equal_v4($student, $reference) {
        $s = trim((string)$student);
        $r = trim((string)$reference);
        if ($s === '' || $r === '') return $s === $r;

        if (!$this->casesensitive) {
            $s = mb_strtolower($s, 'UTF-8');
        }
        foreach (explode('|', $r) as $alias) {
            $alias = trim($alias);
            if (!$this->casesensitive) {
                $alias = mb_strtolower($alias, 'UTF-8');
            }
            if ($s === $alias) return true;
        }

        return false;
    }

    /**
     * Weighted Levenshtein distance between two label sequences.
     * Costs: deletion=1.0, insertion=1.0, substitution=0.66
     */
    protected function irla_token_distance_v4($s_path, $r_path, &$seg_logs = []) {
        $n = count($s_path);
        $m = count($r_path);
        $seg_logs = [];

        // Weighted costs
        $cost_del = 1.0;
        $cost_ins = 1.0;
        $cost_sub = 0.66;

        $dp = [];
        for ($i = 0; $i <= $n; $i++) {
            $dp[$i] = [];
            for ($j = 0; $j <= $m; $j++) $dp[$i][$j] = 0.0;
        }

        for ($i = 0; $i <= $n; $i++) $dp[$i][0] = $i * $cost_del;
        for ($j = 0; $j <= $m; $j++) $dp[0][$j] = $j * $cost_ins;

        for ($i = 1; $i <= $n; $i++) {
            for ($j = 1; $j <= $m; $j++) {
                $is_equal = $this->irla_labels_equal_v4($s_path[$i-1], $r_path[$j-1]);

                if ($i === $j) {
                    $seg_logs[] = (string)$s_path[$i-1] . ($is_equal ? ' == ' : ' != ') . (string)$r_path[$j-1];
                }

                $v_del = $dp[$i-1][$j] + $cost_del;
                $v_ins = $dp[$i][$j-1] + $cost_ins;
                $v_sub = $dp[$i-1][$j-1] + ($is_equal ? 0 : $cost_sub);
                $dp[$i][$j] = min($v_del, $v_ins, $v_sub);
            }
        }

        return $dp[$n][$m];
    }

    public function get_correct_response() {
        // Show only the first of any alternative labels (IP|S becomes IP), as in the review page.
        $response = array('answer' => qtype_syntree_evaluator::strip_alternatives($this->correctanswer));

        if ($this->showfunctions) {
            foreach ($this->get_function_lines() as $index => $line) {
                $parts = explode('|', $line);
                if (count($parts) >= 2) {
                    $variants = explode(';', trim($parts[1]));
                    $v_parts = explode('=', $variants[0]);
                    $response['func_' . $index] = trim($v_parts[0]);
                }
            }
        }

        return $response;
    }
}

/**
 * Helper class for parsing syntax trees and evaluating them using PARSEVAL-like metrics.
 */
class qtype_syntree_evaluator {

    /**
     * Replaces alternative labels with the first one, e.g. [IP|S ...] becomes [IP ...].
     */
    public static function strip_alternatives($bracket) {
        return preg_replace('/\[\s*([^\s\[\]\|]+)\|([^\s\[\]]+)/', '[\1', (string)$bracket);
    }

    /**
     * True if at least one node has a label other than the "?" placeholder.
     */
    public static function has_real_label($bracket) {
        $tokens = self::tokenize((string)$bracket);
        for ($i = 0; $i < count($tokens) - 1; $i++) {
            if ($tokens[$i] === '[') {
                $label = $tokens[$i + 1];
                if ($label !== '[' && $label !== ']' && $label !== '?') {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Pairs the correct leaves with the student's leaves by word (longest common subsequence).
     *
     * @return array Maps the index of a correct leaf to the index of the matching student leaf.
     */
    public static function align_words(array $c_paths, array $s_paths) {
        $norm = function($word) {
            return mb_strtolower(trim((string)$word), 'UTF-8');
        };
        $c_words = array_map(function($p) use ($norm) { return $norm($p['word']); }, $c_paths);
        $s_words = array_map(function($p) use ($norm) { return $norm($p['word']); }, $s_paths);
        $n = count($c_words);
        $m = count($s_words);

        // $lcs[$i][$j] = length of the LCS of the suffixes starting at $i and $j.
        $lcs = array_fill(0, $n + 1, array_fill(0, $m + 1, 0));
        for ($i = $n - 1; $i >= 0; $i--) {
            for ($j = $m - 1; $j >= 0; $j--) {
                $lcs[$i][$j] = ($c_words[$i] === $s_words[$j])
                    ? $lcs[$i + 1][$j + 1] + 1
                    : max($lcs[$i + 1][$j], $lcs[$i][$j + 1]);
            }
        }

        $alignment = [];
        $i = 0;
        $j = 0;
        while ($i < $n && $j < $m) {
            if ($c_words[$i] === $s_words[$j]) {
                $alignment[$i] = $j;
                $i++;
                $j++;
            } else if ($lcs[$i + 1][$j] >= $lcs[$i][$j + 1]) {
                $i++;
            } else {
                $j++;
            }
        }
        return $alignment;
    }

    /**
     * Extracts POS tagging and structural paths for each word in IRLA style.
     */
    public static function get_leaf_paths($bracket) {
        $bracket = trim($bracket);
        if (empty($bracket)) return ['paths' => [], 'root' => null, 'is_multiple' => false];

        $tokens = self::tokenize($bracket);
        $pos = 0;
        $roots = [];
        while ($pos < count($tokens)) {
            $node = self::parse_recursive($tokens, $pos);
            if ($node) $roots[] = $node;
            else $pos++;
        }

        if (count($roots) === 0) return ['paths' => [], 'root' => null, 'is_multiple' => false];

        $is_multiple = count($roots) > 1;
        $root_label = $is_multiple ? null : trim($roots[0]['label'] ?? '?');

        $leaf_data = [];
        foreach ($roots as $root) {
            self::extract_leaf_paths($root, [], $leaf_data);
        }

        $processed = [];
        foreach ($leaf_data as $ld) {
            $path = $ld['path']; // [POS, Intermediate, ..., Root]
            if (empty($path)) {
                $processed[] = ['word' => $ld['word'], 'pos' => '?', 'path' => []];
                continue;
            }

            $pos_tag = array_shift($path); // Removing POS from path

            if (!$is_multiple && count($path) > 0) {
                array_pop($path); // Removing Root from path if single tree
            }
            // If multiple roots, the spec says Root Score is 0,
            // but Hierarchy paths usually compare sub-trees up to their respective roots.
            // I'll keep the sub-roots in the path for multiple trees comparison.

            $processed[] = [
                'word' => $ld['word'],
                'pos' => $pos_tag,
                'path' => $path
            ];
        }

        return [
            'paths' => $processed,
            'root' => $root_label,
            'is_multiple' => $is_multiple
        ];
    }

    private static function extract_leaf_paths($node, $current_path, &$leaf_paths) {
        if ($node['is_leaf']) {
            $leaf_paths[] = [
                'word' => trim($node['label']),
                'path' => $current_path // Path is [POS, Intermediate, ..., Root]
            ];
            return;
        }

        $new_path = $current_path;
        array_unshift($new_path, trim($node['label']));

        foreach ($node['children'] as $child) {
            self::extract_leaf_paths($child, $new_path, $leaf_paths);
        }
    }

    /**
     * ASCII whitespace only. ctype_space() depends on the server locale and with a single-byte
     * locale it can match bytes inside multi-byte UTF-8 characters such as Cyrillic letters.
     */
    private static function is_space($char) {
        return $char === ' ' || $char === "\t" || $char === "\n" || $char === "\r" || $char === "\f" || $char === "\v";
    }

    public static function tokenize($str) {
        $tokens = [];
        $length = strlen($str);
        $i = 0;
        while ($i < $length) {
            if (self::is_space($str[$i])) {
                $i++;
                continue;
            }
            if ($str[$i] === '[' || $str[$i] === ']') {
                $tokens[] = $str[$i];
                $i++;
            } else if ($str[$i] === '"') {
                $i++;
                $start = $i;
                while ($i < $length && $str[$i] !== '"') $i++;
                $tokens[] = substr($str, $start, $i - $start);
                if ($i < $length && $str[$i] === '"') $i++;
            } else {
                $start = $i;
                while ($i < $length && !self::is_space($str[$i]) && $str[$i] !== '[' && $str[$i] !== ']') $i++;
                $tokens[] = substr($str, $start, $i - $start);
            }
        }
        return $tokens;
    }

    private static function parse_recursive($tokens, &$pos) {
        if ($pos >= count($tokens)) return null;

        if ($tokens[$pos] === '[') {
            $pos++;
            $label = ($pos < count($tokens) && $tokens[$pos] !== '[' && $tokens[$pos] !== ']') ? $tokens[$pos++] : '?';

            $children = [];
            while ($pos < count($tokens) && $tokens[$pos] !== ']') {
                $child = self::parse_recursive($tokens, $pos);
                if ($child) $children[] = $child;
            }
            if ($pos < count($tokens) && $tokens[$pos] === ']') $pos++;

            return ['label' => $label, 'children' => $children, 'is_leaf' => false];
        } else {
            return ['label' => $tokens[$pos++], 'is_leaf' => true];
        }
    }
}

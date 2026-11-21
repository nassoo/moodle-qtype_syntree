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
     *
     * @return string[]
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

    /**
     * Describe the response fields expected from a student attempt.
     *
     * @return array Map of field names to PARAM_* types.
     */
    public function get_expected_data() {
        $expected = ['answer' => PARAM_RAW];
        if ($this->showfunctions) {
            foreach (array_keys($this->get_function_lines()) as $index) {
                $expected['func_' . $index] = PARAM_TEXT;
            }
        }
        return $expected;
    }

    /**
     * Produce a plain-text summary of a student's response.
     *
     * @param array $response Submitted response data.
     * @return string|null Summary string or null if empty.
     */
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

    /**
     * Check whether the response contains at least one real label or syntactic function.
     *
     * @param array $response Submitted response data.
     * @return bool
     */
    public function is_complete_response(array $response) {
        // The editor saves the given words as soon as it loads, so a non-empty answer alone
        // does not mean the student did anything. Require a real label or a filled-in function.
        $answer = isset($response['answer']) ? $response['answer'] : '';
        if (\qtype_syntree\evaluator::has_real_label($answer)) {
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

    /**
     * Check whether the response can be graded.
     *
     * @param array $response Submitted response data.
     * @return bool
     */
    public function is_gradable_response(array $response) {
        return $this->is_complete_response($response);
    }

    /**
     * Determine whether two responses are identical across all expected fields.
     *
     * @param array $prevresponse Previous response data.
     * @param array $newresponse New response data.
     * @return bool
     */
    public function is_same_response(array $prevresponse, array $newresponse) {
        // Compare every field, not just the tree, otherwise a change to the functions alone is discarded.
        foreach (array_keys($this->get_expected_data()) as $key) {
            if (!question_utils::arrays_same_at_key_missing_is_blank($prevresponse, $newresponse, $key)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Return a validation error message if the response is not gradable.
     *
     * @param array $response Submitted response data.
     * @return string Error message or empty string.
     */
    public function get_validation_error(array $response) {
        if ($this->is_gradable_response($response)) {
            return '';
        }
        return get_string('pleaseenteryouranswer', 'qtype_syntree');
    }

    /**
     * Grade a student's response and return the fraction and question state.
     *
     * @param array $response Submitted response data.
     * @return array Two-element array of [float $fraction, question_state $state].
     */
    public function grade_response(array $response) {
        $breakdown = $this->get_grading_breakdown($response);
        $finalgrade = round($breakdown['final_grade'], 2);

        if ($finalgrade >= 0.99) {
            return [1.0, question_state::$gradedright];
        } else if ($finalgrade > 0.0) {
            return [$finalgrade, question_state::$gradedpartial];
        } else {
            return [0.0, question_state::$gradedwrong];
        }
    }

    /**
     * Calculates a detailed breakdown of the grade for feedback purposes.
     *
     * @param array $response Submitted response data.
     * @return array Detailed breakdown of scores, weights, and debug paths.
     */
    public function get_grading_breakdown(array $response) {
        $studenttree = isset($response['answer']) ? trim($response['answer']) : '';
        $correcttree = trim($this->correctanswer);

        // 1. Grade the Tree Structure.
        $treescore = 0.0;
        $posscore = 0.0;
        $rootscore = 0.0;
        $hierarchyscore = 0.0;
        $dbglines = [];

        if ($studenttree !== '') {
            $studentclean = preg_replace('/\s+/', '', $studenttree);
            $correctclean = preg_replace('/\s+/', '', $correcttree);

            if ($studentclean === $correctclean) {
                $treescore = 1.0;
                $posscore = 1.0;
                $rootscore = 1.0;
                $hierarchyscore = 1.0;
            } else {
                $cdata = \qtype_syntree\evaluator::get_leaf_paths($correcttree);
                $sdata = \qtype_syntree\evaluator::get_leaf_paths($studenttree);

                $cpaths = $cdata['paths'];
                $spaths = $sdata['paths'];

                // Pair each correct word with the same word in the student's tree, so that one missing
                // or extra word does not shift every word after it. Extra student words count as misses.
                $alignment = \qtype_syntree\evaluator::align_words($cpaths, $spaths);
                $totalwords = max(count($cpaths), count($spaths));

                if (count($cpaths) === 0) {
                    $treescore = 0.0;
                    $posscore = 0.0;
                    $hierarchyscore = 0.0;
                } else {
                    // 1. POS Score (15%).
                    $poscount = 0;
                    foreach ($alignment as $ci => $si) {
                        if ($this->irla_labels_equal_v4((string)$spaths[$si]['pos'], (string)$cpaths[$ci]['pos'])) {
                            $poscount++;
                        }
                    }
                    $posscore = $poscount / $totalwords;

                    // 2. Root Score (5%).
                    $rootscore = 0.0;
                    if (!$sdata['is_multiple'] && !empty($sdata['root'])) {
                        if ($this->irla_labels_equal_v4((string)$sdata['root'], (string)$cdata['root'])) {
                            $rootscore = 1.0;
                        }
                    }

                    // 3. Hierarchy Score (80%).
                    $hsum = 0;
                    for ($i = 0; $i < count($cpaths); $i++) {
                        $wscore = 0.0;
                        $msg = "";
                        if (isset($alignment[$i])) {
                            $cp = $cpaths[$i]['path'];
                            $sp = $spaths[$alignment[$i]]['path'];

                            if (empty($sp) && $sdata['is_multiple'] && !$cdata['is_multiple']) {
                                // The word is not connected to anything in the student's forest of trees.
                                $wscore = 0.0;
                                $msg = "Not attached to the tree";
                            } else if (empty($cp) && empty($sp)) {
                                $wscore = 1.0;
                                $msg = "Match (both empty)";
                            } else if (empty($cp) || empty($sp)) {
                                $wscore = 0.0;
                                $msg = "Mismatch (one empty)";
                            } else {
                                $dist = $this->irla_token_distance_v4($sp, $cp, $seglogs);
                                $maxlen = max(count($sp), count($cp));
                                $wscore = max(0, 1.0 - ($dist / $maxlen));
                                $msg = "Dist: " . round($dist, 2) . "/$maxlen | Segs:{" . implode("|", $seglogs) . "}";
                            }
                        } else {
                            $msg = "Missing student word";
                        }
                        $hsum += $wscore;
                        $dbglines[] = "Word: " . $cpaths[$i]['word'] . " | Score: " . round($wscore, 2) . " | $msg";
                    }
                    $hierarchyscore = $hsum / $totalwords;

                    $pw = isset($this->posweight) ? ($this->posweight / 100.0) : 0.15;
                    $rw = isset($this->rootweight) ? ($this->rootweight / 100.0) : 0.05;
                    $hw = isset($this->hierarchyweight) ? ($this->hierarchyweight / 100.0) : 0.80;
                    $treescore = ($posscore * $pw) + ($rootscore * $rw) + ($hierarchyscore * $hw);
                }
            }
        }

        // 2. Grade the Syntactic Functions.
        $funcdetails = [];
        $funcgrade = 1.0;
        if ($this->showfunctions) {
            $funcresults = $this->grade_functions($response);
            $funcgrade = $funcresults['grade'];
            $funcdetails = $funcresults['details'];
        }

        // 3. Combine Grades.
        $treeweight = $this->treeweight / 100.0;
        $funcweight = 1.0 - $treeweight;

        if (!$this->showfunctions) {
            $finalgrade = $treescore;
        } else {
            $finalgrade = ($treescore * $treeweight) + ($funcgrade * $funcweight);
        }

        return [
            'tree_score'        => $treescore,
            'tree_weight'       => $this->treeweight,
            'posweight'         => isset($this->posweight) ? $this->posweight : 15,
            'rootweight'        => isset($this->rootweight) ? $this->rootweight : 5,
            'hierarchyweight'   => isset($this->hierarchyweight) ? $this->hierarchyweight : 80,
            'pos_score'         => $posscore,
            'root_score'        => $rootscore,
            'hierarchy_score'   => $hierarchyscore,
            'word_debug'        => $dbglines,
            'functions_grade'   => $funcgrade,
            'functions_weight'  => $this->showfunctions ? (100 - $this->treeweight) : 0,
            'functions_details' => $funcdetails,
            'final_grade'       => $finalgrade,
        ];
    }

    /**
     * Helper to grade the individual function responses.
     *
     * @param array $response Submitted response data.
     * @return array Array with keys 'grade' and 'details'.
     */
    protected function grade_functions(array $response) {
        $totalitems = 0;
        $earnedmarks = 0;
        $details = [];

        // The index must follow get_expected_data(), which numbers every non-empty line.
        foreach ($this->get_function_lines() as $index => $line) {
            $totalitems++;
            $parts = explode('|', $line);
            $phrase = trim($parts[0]);
            if (count($parts) < 2) {
                $details[] = [
                    'phrase' => $phrase,
                    'student' => '',
                    'expected' => '?',
                    'score' => 0,
                ];
                continue;
            }

            $studentansraw = isset($response['func_' . $index]) ? trim($response['func_' . $index]) : '';
            $studentans = mb_strtolower($studentansraw);
            $configstr = trim($parts[1]);

            $variants = explode(';', $configstr);
            $bestmatchmark = 0;
            $expecteddisplay = '';

            foreach ($variants as $vidx => $variant) {
                $vparts = explode('=', $variant);
                $vtext = trim(mb_strtolower($vparts[0]));
                $vmark = isset($vparts[1]) ? (int)trim($vparts[1]) : 100;

                if ($vidx === 0) {
                    $expecteddisplay = trim($vparts[0]);
                }

                if ($studentans === $vtext) {
                    $bestmatchmark = max($bestmatchmark, $vmark);
                }
            }

            $earnedmarks += ($bestmatchmark / 100.0);
            $details[] = [
                'phrase' => $phrase,
                'student' => $studentansraw,
                'expected' => $expecteddisplay,
                'score' => $bestmatchmark / 100.0,
            ];
        }

        $grade = ($totalitems > 0) ? ($earnedmarks / $totalitems) : 1.0;
        return ['grade' => $grade, 'details' => $details];
    }

    /**
     * RENAMED V4: Strictly check if two labels match (including aliases such as IP|S in the reference).
     *
     * @param string $student Student label.
     * @param string $reference Reference label (possibly containing '|' alternatives).
     * @return bool
     */
    protected function irla_labels_equal_v4($student, $reference) {
        $s = trim((string)$student);
        $r = trim((string)$reference);
        if ($s === '' || $r === '') {
            return $s === $r;
        }

        if (!$this->casesensitive) {
            $s = mb_strtolower($s, 'UTF-8');
        }
        foreach (explode('|', $r) as $alias) {
            $alias = trim($alias);
            if (!$this->casesensitive) {
                $alias = mb_strtolower($alias, 'UTF-8');
            }
            if ($s === $alias) {
                return true;
            }
        }

        return false;
    }

    /**
     * Weighted Levenshtein distance between two label sequences.
     * Costs: deletion=1.0, insertion=1.0, substitution=0.66
     *
     * @param array $spath Student path labels.
     * @param array $rpath Reference path labels.
     * @param array $seglogs Segment comparison log output.
     * @return float Weighted edit distance.
     */
    protected function irla_token_distance_v4($spath, $rpath, &$seglogs = []) {
        $n = count($spath);
        $m = count($rpath);
        $seglogs = [];

        // Weighted costs.
        $costdel = 1.0;
        $costins = 1.0;
        $costsub = 0.66;

        $dp = [];
        for ($i = 0; $i <= $n; $i++) {
            $dp[$i] = [];
            for ($j = 0; $j <= $m; $j++) {
                $dp[$i][$j] = 0.0;
            }
        }

        for ($i = 0; $i <= $n; $i++) {
            $dp[$i][0] = $i * $costdel;
        }
        for ($j = 0; $j <= $m; $j++) {
            $dp[0][$j] = $j * $costins;
        }

        for ($i = 1; $i <= $n; $i++) {
            for ($j = 1; $j <= $m; $j++) {
                $isequal = $this->irla_labels_equal_v4($spath[$i - 1], $rpath[$j - 1]);

                if ($i === $j) {
                    $seglogs[] = (string)$spath[$i - 1] . ($isequal ? ' == ' : ' != ') . (string)$rpath[$j - 1];
                }

                $vdel = $dp[$i - 1][$j] + $costdel;
                $vins = $dp[$i][$j - 1] + $costins;
                $vsub = $dp[$i - 1][$j - 1] + ($isequal ? 0 : $costsub);
                $dp[$i][$j] = min($vdel, $vins, $vsub);
            }
        }

        return $dp[$n][$m];
    }

    /**
     * Build the expected correct response array for previewing and auto-filling.
     *
     * @return array Expected response fields.
     */
    public function get_correct_response() {
        // Show only the first of any alternative labels (IP|S becomes IP), as in the review page.
        $response = ['answer' => \qtype_syntree\evaluator::strip_alternatives($this->correctanswer)];

        if ($this->showfunctions) {
            foreach ($this->get_function_lines() as $index => $line) {
                $parts = explode('|', $line);
                if (count($parts) >= 2) {
                    $variants = explode(';', trim($parts[1]));
                    $vparts = explode('=', $variants[0]);
                    $response['func_' . $index] = trim($vparts[0]);
                }
            }
        }

        return $response;
    }
}

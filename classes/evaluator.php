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
 * Helper class for parsing syntax trees and evaluating them using PARSEVAL-like metrics.
 *
 * Additional terms under GNU GPL v3 section 7 apply, see the NOTICE file.
 *
 * @package    qtype_syntree
 * @copyright  2026 Atanas Atanasov
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace qtype_syntree;

/**
 * Helper class for parsing syntax trees and evaluating them using PARSEVAL-like metrics.
 */
class evaluator {
    /**
     * Replaces alternative labels with the first one, e.g. [IP|S ...] becomes [IP ...].
     *
     * @param string|null $bracket The bracket notation string.
     * @return string|null The bracket notation with alternative labels stripped.
     */
    public static function strip_alternatives($bracket) {
        return preg_replace('/\[\s*([^\s\[\]\|]+)\|([^\s\[\]]+)/', '[\1', (string)$bracket);
    }

    /**
     * True if at least one node has a label other than the "?" placeholder.
     *
     * @param string|null $bracket The bracket notation string.
     * @return bool
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
     * @param array $cpaths Leaf path entries from the reference tree.
     * @param array $spaths Leaf path entries from the student tree.
     * @return array Maps the index of a correct leaf to the index of the matching student leaf.
     */
    public static function align_words(array $cpaths, array $spaths) {
        $norm = function ($word) {
            return mb_strtolower(trim((string)$word), 'UTF-8');
        };
        $cwords = array_map(
            function ($p) use ($norm) {
                return $norm($p['word']);
            },
            $cpaths
        );
        $swords = array_map(
            function ($p) use ($norm) {
                return $norm($p['word']);
            },
            $spaths
        );
        $n = count($cwords);
        $m = count($swords);

        // Compute $lcs[$i][$j] as the length of the LCS of the suffixes starting at $i and $j.
        $lcs = array_fill(0, $n + 1, array_fill(0, $m + 1, 0));
        for ($i = $n - 1; $i >= 0; $i--) {
            for ($j = $m - 1; $j >= 0; $j--) {
                $lcs[$i][$j] = ($cwords[$i] === $swords[$j])
                    ? $lcs[$i + 1][$j + 1] + 1
                    : max($lcs[$i + 1][$j], $lcs[$i][$j + 1]);
            }
        }

        $alignment = [];
        $i = 0;
        $j = 0;
        while ($i < $n && $j < $m) {
            if ($cwords[$i] === $swords[$j]) {
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
     *
     * @param string $bracket The bracket notation string.
     * @return array Array with keys 'paths', 'root', and 'is_multiple'.
     */
    public static function get_leaf_paths($bracket) {
        $bracket = trim($bracket);
        if (empty($bracket)) {
            return ['paths' => [], 'root' => null, 'is_multiple' => false];
        }

        $tokens = self::tokenize($bracket);
        $pos = 0;
        $roots = [];
        while ($pos < count($tokens)) {
            $node = self::parse_recursive($tokens, $pos);
            if ($node) {
                $roots[] = $node;
            } else {
                $pos++;
            }
        }

        if (count($roots) === 0) {
            return ['paths' => [], 'root' => null, 'is_multiple' => false];
        }

        $ismultiple = count($roots) > 1;
        $rootlabel = $ismultiple ? null : trim($roots[0]['label'] ?? '?');

        $leafdata = [];
        foreach ($roots as $root) {
            self::extract_leaf_paths($root, [], $leafdata);
        }

        $processed = [];
        foreach ($leafdata as $ld) {
            // Path is [POS, Intermediate, ..., Root].
            $path = $ld['path'];
            if (empty($path)) {
                $processed[] = ['word' => $ld['word'], 'pos' => '?', 'path' => []];
                continue;
            }

            // Removing POS from path.
            $postag = array_shift($path);

            if (!$ismultiple && count($path) > 0) {
                // Removing Root from path if single tree.
                array_pop($path);
            }
            // If multiple roots, the spec says Root Score is 0,
            // but Hierarchy paths usually compare sub-trees up to their respective roots.
            // I'll keep the sub-roots in the path for multiple trees comparison.

            $processed[] = [
                'word' => $ld['word'],
                'pos' => $postag,
                'path' => $path,
            ];
        }

        return [
            'paths' => $processed,
            'root' => $rootlabel,
            'is_multiple' => $ismultiple,
        ];
    }

    /**
     * Recursively collects leaf words and their ancestor label paths.
     *
     * @param array $node Current AST node.
     * @param array $currentpath Ancestor labels accumulated so far.
     * @param array $leafpaths Collected leaf path entries (output).
     * @return void
     */
    private static function extract_leaf_paths($node, $currentpath, &$leafpaths) {
        if ($node['is_leaf']) {
            $leafpaths[] = [
                'word' => trim($node['label']),
                // Path is [POS, Intermediate, ..., Root].
                'path' => $currentpath,
            ];
            return;
        }

        $newpath = $currentpath;
        array_unshift($newpath, trim($node['label']));

        foreach ($node['children'] as $child) {
            self::extract_leaf_paths($child, $newpath, $leafpaths);
        }
    }

    /**
     * ASCII whitespace only. ctype_space() depends on the server locale and with a single-byte
     * locale it can match bytes inside multi-byte UTF-8 characters such as Cyrillic letters.
     *
     * @param string $char Single byte character to test.
     * @return bool
     */
    private static function is_space($char) {
        return $char === ' ' || $char === "\t" || $char === "\n" || $char === "\r" || $char === "\f" || $char === "\v";
    }

    /**
     * Tokenizes a bracket notation string into brackets, quoted strings, and labels/words.
     *
     * @param string $str The bracket notation string.
     * @return array List of string tokens.
     */
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
                while ($i < $length && $str[$i] !== '"') {
                    $i++;
                }
                $tokens[] = substr($str, $start, $i - $start);
                if ($i < $length && $str[$i] === '"') {
                    $i++;
                }
            } else {
                $start = $i;
                while ($i < $length && !self::is_space($str[$i]) && $str[$i] !== '[' && $str[$i] !== ']') {
                    $i++;
                }
                $tokens[] = substr($str, $start, $i - $start);
            }
        }
        return $tokens;
    }

    /**
     * Recursively parses tokens into an AST node.
     *
     * @param array $tokens List of tokens produced by tokenize().
     * @param int $pos Current index in the token list (updated in place).
     * @return array|null Parsed node array or null at end of tokens.
     */
    private static function parse_recursive($tokens, &$pos) {
        if ($pos >= count($tokens)) {
            return null;
        }

        if ($tokens[$pos] === '[') {
            $pos++;
            $label = ($pos < count($tokens) && $tokens[$pos] !== '[' && $tokens[$pos] !== ']') ? $tokens[$pos++] : '?';

            $children = [];
            while ($pos < count($tokens) && $tokens[$pos] !== ']') {
                $child = self::parse_recursive($tokens, $pos);
                if ($child) {
                    $children[] = $child;
                }
            }
            if ($pos < count($tokens) && $tokens[$pos] === ']') {
                $pos++;
            }

            return ['label' => $label, 'children' => $children, 'is_leaf' => false];
        } else {
            return ['label' => $tokens[$pos++], 'is_leaf' => true];
        }
    }
}

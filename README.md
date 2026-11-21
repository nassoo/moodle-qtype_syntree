# Syntax Tree question type for Moodle (`qtype_syntree`)

Students build a syntax tree for a sentence in a visual editor directly inside a Moodle quiz, and the tree is graded automatically against the teacher's reference tree. Optionally, students also name the syntactic function of given phrases.

A standalone web version of the same editor is available at <https://syntree.ezik.bg>.

## Features

- **Visual tree editor** in the quiz: label nodes, add parents and children, drag and drop to restructure, collapse phrases into triangles, zoom and pan, undo and redo (also with Ctrl+Z / Ctrl+Y), touch support (long press, pinch to zoom).
- **The teacher draws the reference tree** in the same editor, or pastes it in bracket notation, e.g. `[S [NP [D the] [N dog]] [VP [V barks]]]`.
- **Alternative labels** for a node: `[IP|S ...]` accepts either `IP` or `S`.
- **Partial credit.** The tree score combines part-of-speech accuracy, root identification and internal hierarchy. The weights are configurable per question (default 15 / 5 / 80). Words are matched by their text, so one missing word does not shift the rest.
- **Syntactic functions (optional).** A table where students name the function of given phrases. Each line accepts several answers with their own marks, e.g. `a cat | direct object=100; object=50`. The question sets the split between the tree and the functions (default 70 / 30).
- **Case-sensitive labels (optional)**, for frameworks where `vP` and `VP` are different categories.
- **Detailed feedback** after the attempt, including a word-by-word comparison of the structural paths.
- Moodle XML import and export, course backup and restore, Privacy API, translatable UI.

## Requirements

- Moodle 4.5 to 5.3 (developed and tested on 5.3).

## Installation

1. Put the plugin in `question/type/syntree` of your Moodle code. On Moodle 5.1 and later the path is `public/question/type/syntree`. You can either upload the ZIP through *Site administration > Plugins > Install plugins*, or use:
   ```
   git clone https://github.com/nassoo/moodle-qtype_syntree.git public/question/type/syntree
   ```
2. Visit *Site administration > Notifications* to finish the installation.

## Usage

1. In the question bank, add a new **Syntax Tree** question.
2. Draw the correct tree in the editor, or import it in bracket notation. Use `|` in a label to allow alternatives.
3. Optionally:
   - enable the syntactic functions table and list the phrases and their accepted answers;
   - adjust the grading weights;
   - allow students to import bracket notation;
   - make labels case-sensitive.
4. Students see the words of the sentence and build the tree above them.

A guide for teachers and students is built into the editor (the *Help* button).

## Repository layout

| Path | Content |
|---|---|
| `*.php`, `db/`, `lang/`, `amd/`, `backup/`, `classes/`, `pix/` | The Moodle plugin |
| `vue_app/dist/` | The built editor (`syntree.bundle.js`) and the guides. The folder name is historical; the editor is plain TypeScript. |
| `editor/` | **Source code of the editor** (TypeScript) and its build configuration |

### Building the editor

The built files in `vue_app/dist/` are committed, so you only need to build if you change the editor:

```
cd editor
npm ci
npm run build
```

The build writes `syntree.bundle.js` and the guides to `../vue_app/dist/`.

## Reporting problems

Please use [GitHub Issues](https://github.com/nassoo/moodle-qtype_syntree/issues).

## License

Copyright (C) 2026 Atanas Atanasov.

This program is free software, licensed under the **GNU General Public License version 3 or later** (see [LICENSE](LICENSE)), with **additional terms under section 7** (see [NOTICE](NOTICE)):
- the author attribution "Syntax Tree Editor by Atanas Atanasov" must stay in the editor's guide and in the plugin description;
- modified versions must be marked as such;
- the name "Syntax Tree Editor" and the author's name may not be used to promote derived works.

## Citation

If you use this software in academic work, please cite:

```bibtex
@inproceedings{atanasov2026dual,
  author    = {Atanas Atanasov},
  title     = {A Dual-Interface Syntax Tree Editor with Automated Assessment for Learning Management Systems},
  booktitle = {Proceedings of the Seventh International Conference Computational Linguistics in Bulgaria (CLIB 2026)},
  year      = {2026},
  address   = {Sofia, Bulgaria},
  publisher = {Institute for Bulgarian Language, Bulgarian Academy of Sciences},
  pages     = {173--179},
  issn      = {2367-5675},
  url       = {https://dcl.bas.bg/clib/wp-content/uploads/2026/09/CLIB2026_20_Atanasov_173-179.pdf}
}
```

GitHub also offers this citation through *Cite this repository* (see [CITATION.cff](CITATION.cff)).

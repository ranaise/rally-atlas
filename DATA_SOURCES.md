# Data sources and methodology

## Source and revision

Wei-Yao Wang, Yung-Chang Huang, Tsi-Ui Ik and Wen-Chih Peng. 2023. *ShuttleSet: A Human-Annotated Stroke-Level Singles Dataset for Badminton Tactical Analysis*. KDD 2023. [Research paper](https://arxiv.org/abs/2306.04948)

The pipeline pins CoachAI-Projects to commit `45517f7d4cb936b03f3eabf939cc7959d39226fe`. It reads the official `match.csv`, `homography.csv` and selected `setN.csv` files from `ShuttleSet/set/`. The [input manifest](data/manifest.json) lists the exact relative paths and SHA-256 hashes. The processed asset retains the [upstream MIT license](public/data/SHUTTLESET-LICENSE.txt). [Official data dictionary and CSVs](https://github.com/wywyWang/CoachAI-Projects/tree/45517f7d4cb936b03f3eabf939cc7959d39226fe/ShuttleSet)

## Included match sample

All matches are men’s singles. The sample was chosen to cover matches featuring Anthony Sinisuka Ginting or Jonatan Christie, including both Ginting–Axelsen meetings in the source.

| ID | Date | Event and round | Players in source A/B order | Sets | Retained rallies | Classified strokes |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 11 | 2019-07-19 | Indonesia Open, quarter-finals | Chou Tien Chen / Jonatan Christie | 3 | 111 | 1,152 |
| 14 | 2020-01-17 | Indonesia Masters, quarter-finals | Anders Antonsen / Jonatan Christie | 3 | 97 | 1,018 |
| 15 | 2020-01-19 | Indonesia Masters, final | Anthony Sinisuka Ginting / Anders Antonsen | 3 | 87 | 807 |
| 16 | 2020-01-18 | Indonesia Masters, semi-finals | Anthony Sinisuka Ginting / Viktor Axelsen | 2 | 60 | 506 |
| 24 | 2021-01-15 | Yonex Thailand Open, quarter-finals | Anthony Sinisuka Ginting / Rasmus Gemke | 3 | 96 | 1,049 |
| 26 | 2021-01-15 | Yonex Thailand Open, quarter-finals | Viktor Axelsen / Jonatan Christie | 2 | 56 | 636 |
| 27 | 2021-01-16 | Yonex Thailand Open, semi-finals | Viktor Axelsen / Anthony Sinisuka Ginting | 3 | 104 | 1,016 |
| 39 | 2021-01-29 | HSBC BWF World Tour Finals 2020, Group A (round robin) | Anthony Sinisuka Ginting / Lee Zii Jia | 3 | 102 | 777 |
| | | **Total** | | **22** | **713** | **6,961** |

Dates and event names come from the upstream match metadata. The 2020-branded World Tour Finals match in the sample took place in January 2021. **Correction:** upstream `match.csv` labels match 39 as a quarter-final. Its January 29 Ginting–Lee fixture was actually a Group A round-robin match, so the preprocessing script corrects the displayed round while preserving the original source CSVs. [Contemporary match report](https://tirto.id/hasil-bwf-world-tour-final-29-jan-2021-klasemen-akhir-tunggal-putra-f9L5).

## From source rows to rallies

- `match ID + set number + rally number` identifies a rally. `ball_round` identifies the stroke slot within that rally. Order is checked against the source sequence. For match 24, set 3, rally 25, a second flagged stroke-1 row appended after the recorded end was removed.
- A is the match winner and B is the match loser, as defined upstream. The separate `getpoint_player` label determines the rally winner. It can be absent on nonterminal rows. A rally with no winner label remains unresolved, even when adjacent scores suggest an outcome. Scores are reproduced as recorded.
- Of 7,277 CSV rows across 742 source rally groups, 29 rows from 29 entirely flagged rallies and one trailing duplicate were excluded. Of the 7,247 retained stroke slots, 286 flagged or unclassified slots retain their sequence number and hitter label for replay. They supply no shot category or coordinates to the analysis. The other 6,961 strokes use the official 18-category translation. Both `過度切球` (the CSV spelling) and `過渡切球` (the dictionary spelling) map to passive drop.
- The unfiltered rally-length histogram includes 712 of the 713 replayable rallies. Match 39, set 2, rally 27 has a known winner and a single unclassified stroke slot, so it appears in replay and falls outside the chart’s classified-stroke cohort.

## Camera and court coordinates

For each match, the script applies the supplied matrix to the camera point `[x, y, 1]` and divides by the homogeneous scale. It checks that the four projected reference corners form the expected rectangle. It then uses those projected extents to scale to a 1,340 cm × 610 cm court, rotated clockwise for display. Camera bottom is on the left (near end), camera top is on the right (far end), and the camera’s left side is at the top of the display. This accommodates the small difference in transformed horizontal reference bounds between matches. It preserves the same camera frame when players change ends. One classified stroke is missing a destination, and 234 destinations fall outside the modeled singles boundaries. The pipeline preserves finite out-of-bounds coordinates. [ShuttleSet coordinate conventions](https://arxiv.org/html/2306.04948) · [BWF Laws of Badminton, Diagram A](https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/SECTION%204.1-%20Laws%20of%20Badminton.pdf)

The diagram uses a 5.18 m singles width, 1.98 m short service offset and 0.76 m doubles long service offset. The map groups depth from the net into forecourt (under 1.98 m), midcourt (1.98 m to under 4.34 m) and rear court (4.34 m to the baseline). These are application-defined depth bands. The geometry is for comparison and exploration. Manual annotation, perspective and line thickness limit boundary precision. Points mark destinations including interceptions, net contact and terminal landings. Replay shows snapshots of player positions at the recorded stroke.

## Spatial aggregation and denominators

Density uses 96 equal-area cells, 16 along the court by 6 across it. Each cell is approximately 0.84 m × 0.86 m. The outer edges include their boundary points. Interior grid lines assign a point to the cell with the greater coordinate on that axis. The shade encodes the cell count divided by the number of in-court destinations for that map. The map uses six equal-width color intervals, with a separate neutral fill for zero observations. The upper end of the color scale is the maximum cell share rounded up to a whole percentage point, with a minimum of 1%. Two-player maps share the same upper end and court geometry. The point view pages through 350 classified in-court records at a time in match, set, rally and stroke order.

The two-player views and the two-player scouting insight use the same pair. They use the match, set and shot filters, and the two named players determine the comparison cohort. The main player filter applies to the single court, overall shot totals, histogram, sequence, outcomes and the other scouting observations.

| View | Denominator |
| --- | --- |
| Shot mix | All classified strokes meeting the filters |
| Density cell share | All in-court destinations in the displayed court. Player comparisons calculate this separately for each player. |
| Zone shares | Selected strokes with a destination inside the singles outline |
| Rally lengths | Unique retained rallies with at least one selected stroke. The histogram uses consecutive bins of five lengths. Mean and median use the underlying lengths, including all retained stroke slots. |
| Stroke position | Selected classified strokes in each source stroke-number range |
| Next shot | Pairs for the chosen preceding shot where the next shot is classified and meets the filters. Both slots must be adjacent in the same rally. |
| Compare players | Each player’s own classified strokes under the match, set and shot filters |
| Short versus long | Selected classified strokes in each length group, using 1–5 and 15+ recorded slots |
| Final shot outcome | Selected strokes in the actual final recorded slot, with classified shot type and known winner |
| Terminal placement | The same terminal cohort, limited to strokes with a destination |

The outcome views report the share where the last hitter won the rally. Groups below 20 rallies use a hollow marker as a small-sample warning. These results combine multiple kinds of endings and describe associations. Rows and rallies are clustered by player and match. The results apply to this selected sample.

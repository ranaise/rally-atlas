# Rally Atlas

## Team and academic affiliation

Rally Atlas Team, Telkom University, Indonesia. Prepared for the AQX Sports Analytics Data Bowl 4.0 and the Data Visualization midterm.

## Problem statement

A badminton scoreline records who won a point, but coaches and players preparing for a match also need to know which shots recur, where the shuttle is played, and how the exchanges develop.

## Project objective

Use recorded shot patterns to support match preparation and player scouting. The prototype helps users identify patterns worth reviewing in specific rallies.

## Dataset and coverage

The prototype covers eight selected professional men's singles matches featuring Anthony Sinisuka Ginting or Jonatan Christie, played from July 2019 to January 2021. It includes 22 sets, 713 replayable rallies and 6,961 classified strokes. The placement map uses 6,726 in-court destinations.

## Data preparation

A Python pipeline uses pinned ShuttleSet CSVs, validates rally and stroke keys, and projects camera coordinates onto a common court using the published match calibrations. Unresolved stroke slots remain in replay. One replayable rally has no classified stroke, so the unfiltered length histogram has 712 eligible rallies.

## Visualization methods

The density map divides the singles court into 96 cells of about 0.72 m² each. Color shows each cell's share of in-court destinations. Two-player maps use the same color scale and separate player denominators. Tactical views compare shot shares, group lengths into five-stroke bins, show the shot mix by stroke position or consecutive shot, and group final strokes by type or destination.

## Interactive features

Filter by match, player, set or shot type. Switch between density, depth zones and point records. Compare two players, inspect counts and denominators, and step or play through annotated rallies.

## Key analytical findings

- Net shots were the most frequent category, with 1,342 of 6,961 classified strokes (19.3%). They made up 272 of 685 second strokes (39.7%) and 288 of 1,470 strokes at positions 8 through 12 (19.6%).
- Lobs represented 188 of Ginting's 2,077 classified strokes (9.1%) and 203 of Christie's 1,405 (14.4%). They had the largest shot-share gap for this comparison pair.
- The busiest court cell held 225 of 6,726 in-court destinations (3.3%). Among 118 rallies ending in a classified smash with a known winner, the last hitter won 75 (63.6%). This rate describes recorded endings, including faults.

## Practical application

A coach can use the shot mix and sequence charts to shortlist exchanges, check where those shots were recorded, and review selected rallies with a player. For example, the lob share difference gives a coach a concrete pattern to examine against specific opponents before drawing a tactical conclusion.

## Limitations

The sample includes different opponents and match conditions. Later positions contain only rallies that reached those positions. Shuttle destinations can include interceptions, and the court keeps fixed camera ends. Three retained rallies lack a winner label. The analysis is descriptive. The prototype provides no validated predictions or causal estimates of shot effectiveness.

## Technology stack

React, TypeScript, Vite, D3, visx and Radix UI. The static build serves local fonts and data. Python verifies the data pipeline, Vitest checks calculations, and Playwright checks browser behavior.

## Prototype and GitHub links

Prototype: https://ranaise.github.io/rally-atlas/

Source code: https://github.com/ranaise/rally-atlas

## Data attribution

ShuttleSet by Wei-Yao Wang, Yung-Chang Huang, Tsi-Ui Ik and Wen-Chih Peng, KDD 2023. The bundled data retains the upstream MIT notice. [Research paper](https://arxiv.org/abs/2306.04948) · [Official dataset and documentation](https://github.com/wywyWang/CoachAI-Projects/blob/main/ShuttleSet/README.md)


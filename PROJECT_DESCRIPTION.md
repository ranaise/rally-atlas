# Rally Atlas — Interactive Badminton Analytics

**Project:** AQX Sports Analytics Data Bowl 4.0 / Data Visualization Midterm  
**Institution:** Telkom University, Indonesia

## Team members

- Farha Amirah Hasibuan
- Azzahra Indah
- Rafa'na'ilah Septia
- Tisee Tisee
- Kayla Ulfiyah Haurani

## Project overview

Rally Atlas is an interactive web application for exploring shot placement, rally sequences, and player tendencies in professional badminton singles. It turns stroke-level match records into court visualizations and statistical comparisons that are easier to explore than match scores alone.

## Problem and objective

A match score tells us who won, but not which shots were played, where the shuttle was directed, or how rallies developed. Rally Atlas helps coaches, players, and analysts examine these patterns and identify specific exchanges worth reviewing before a match.

## Features

- **Shot placement:** An interactive singles-court density map with 96 equal-area cells, zone summaries, individual shot locations, and player comparisons.
- **Rally replay:** A step-by-step reconstruction of annotated strokes, player positions, destinations, and rally outcomes.
- **Tactical patterns:** Player shot-share comparisons, rally-length distributions, stroke-position and next-shot patterns, and final-shot outcomes.
- **Scouting insights:** Filter-responsive observations that point users toward relevant charts and rallies.

Users can filter by match, player, set, and shot type. Court comparisons share a color scale so the two selected players can be evaluated consistently.

## Dataset and methods

The prototype uses a selected subset of [ShuttleSet](https://github.com/wywyWang/CoachAI-Projects/tree/main/ShuttleSet): **8 men's singles matches**, **22 sets**, **713 replayable rallies**, and **6,961 classified strokes**, recorded between July 2019 and January 2021. Of the classified strokes, **6,726** have destinations within the modeled singles court.

Python scripts clean and validate the source CSVs, retain uncertain strokes in their original rally positions, and project recorded camera coordinates onto a common court. The website uses React, TypeScript, Vite, D3, and visx to visualize the processed data. See [Data Sources and Methodology](DATA_SOURCES.md) for sampling decisions, definitions, and calculation details.

## Selected findings

- **Net shots** were the most common recorded shot type: **1,342 of 6,961** classified strokes (**19.3%**).
- **Lobs** accounted for **188 of 2,077** classified strokes by Anthony Sinisuka Ginting (**9.1%**) and **203 of 1,405** by Jonatan Christie (**14.4%**) in this sample. Their opponents and match coverage differ, so this is a descriptive comparison.
- Across **118** rallies that ended with a classified smash and had a known winner, the last hitter won **75** (**63.6%**). This includes different types of rally endings and is not a causal estimate of smash effectiveness.

## Practical application

A coach can compare shot tendencies, inspect where those shots were directed, and open selected rallies for closer review. For example, the difference in recorded lob usage can guide which rallies to inspect when preparing a player-specific scouting session. Rally Atlas supports informed tactical review; it does not generate validated predictions or automatic coaching decisions.

## Limitations

This is a selected group of professional matches, not a representative sample of all badminton. Player comparisons can be affected by opponents and match conditions. Replay shows recorded stroke-level positions, not continuous tracking or the real-time flight path of the shuttle. Some annotations and outcomes are incomplete. Spatial destinations can represent interceptions or terminal contacts rather than only where a shot landed. The reported findings are descriptive associations.

## Links and attribution

- **Live prototype:** https://ranaise.github.io/rally-atlas/
- **Public source code:** https://github.com/ranaise/rally-atlas
- **Dataset:** [ShuttleSet / CoachAI-Projects](https://github.com/wywyWang/CoachAI-Projects/tree/main/ShuttleSet)
- **Paper:** [ShuttleSet: A Human-Annotated Stroke-Level Singles Dataset for Badminton Tactical Analysis](https://arxiv.org/abs/2306.04948)

ShuttleSet was published by Wei-Yao Wang, Yung-Chang Huang, Tsi-Ui Ik, and Wen-Chih Peng (KDD 2023). Dataset and third-party licenses are retained in the repository.

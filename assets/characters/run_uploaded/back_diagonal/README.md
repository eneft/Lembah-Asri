# Approved rear-diagonal run sprite

Place the exact PNG named `lembah_asri_run_49_7x7_transparent_lossless.png` here.

Source: user-provided 49-frame transparent sprite sheet, 7x7 cells, 768x1168 px per frame (5376x8176 total).

The isolated `run8_uploaded.gd` loads this native sheet for `up_right` (back-right), and mirrors the same image for `up_left` (back-left). Until the PNG arrives, a legacy temporary rear-diagonal source is used to keep the test running.

Do not resize, re-encode, or add character assets to the main scene. The `/run8-uploaded/` URL tests the isolated scene.
